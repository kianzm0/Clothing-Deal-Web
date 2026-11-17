import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { tokenHash, consumeAccountToken, authenticatedAccountAction, purgeAccountHistory, requestAccountToken } from "../lib/account-lifecycle";
import { authOptions } from "../lib/auth";
async function main() {
  if (process.env.ACCOUNT_TEST_DATABASE !== "1") throw new Error("Requires disposable database");
  const password = "original-test-password", nextPassword = "replacement-test-password";
  const user = await prisma.user.create({ data: { email: `account-${crypto.randomUUID()}@example.test`, passwordHash: await bcrypt.hash(password, 10) } });
  const token = "a".repeat(64), expired = "b".repeat(64), verify = "c".repeat(64);
  try {
    await prisma.accountToken.createMany({ data: [
      { hash: tokenHash(token), userId: user.id, purpose: "reset", expiresAt: new Date(Date.now() + 60000) },
      { hash: tokenHash(expired), userId: user.id, purpose: "reset", expiresAt: new Date(0) },
      { hash: tokenHash(verify), userId: user.id, purpose: "verify", expiresAt: new Date(Date.now() + 60000) },
    ] });
    await assert.rejects(consumeAccountToken(expired, "reset", nextPassword), /Invalid or expired/);
    await assert.rejects(consumeAccountToken(verify, "reset", nextPassword), /Invalid or expired/);
    const reset = await Promise.allSettled([consumeAccountToken(token, "reset", nextPassword), consumeAccountToken(token, "reset", nextPassword)]);
    assert.equal(reset.filter(r => r.status === "fulfilled").length, 1);
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(changed.sessionVersion, 1); assert.ok(await bcrypt.compare(nextPassword, changed.passwordHash));
    const callback = authOptions.callbacks!.session!;
    const session = await callback({ session: { user: { id: user.id, role: "USER" }, expires: "" }, token: { id: user.id, sessionVersion: 0 } } as any);
    assert.equal((session as import("next-auth").Session).user.id, "");
    await consumeAccountToken(verify, "verify");
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt);
    await assert.rejects(authenticatedAccountAction(user.id, password, "delete"), /incorrect/);
    await prisma.interaction.create({ data: { userId: user.id, productId: "historical", action: "SAVE", reward: 1, createdAt: new Date(0) } });
    await prisma.banditWeights.create({ data: { userId: user.id, weights: [1] } });
    await purgeAccountHistory();
    assert.equal(await prisma.interaction.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.banditWeights.findUnique({ where: { userId: user.id } }), null);
    await authenticatedAccountAction(user.id, nextPassword, "sessions");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 2);
    // Stub delivery only: no real email is sent by CI.
    process.env.ACCOUNT_MAIL_ENDPOINT = "https://mailer.example.test/send";
    process.env.ACCOUNT_MAIL_SECRET = "test-only";
    const fetchBefore = globalThis.fetch;
    let deliveries = 0;
    globalThis.fetch = async () => { deliveries++; return new Response("", { status: 202 }); };
    try {
      await Promise.all([requestAccountToken(user.email, "reset"), requestAccountToken(user.email, "reset")]);
      assert.equal(deliveries, 1);
      await requestAccountToken("missing@example.test", "reset"); assert.equal(deliveries, 1);
    } finally { globalThis.fetch = fetchBefore; }
    await authenticatedAccountAction(user.id, nextPassword, "delete");
    assert.equal(await prisma.accountToken.count({ where: { userId: user.id } }), 0);
  } finally { await prisma.user.deleteMany({ where: { id: user.id } }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
