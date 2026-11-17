import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { AccountInputError, parseSignup } from "./account-input";

export type TokenPurpose = "reset" | "verify";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function validToken(token: unknown): token is string { return typeof token === "string" && /^[a-f0-9]{64}$/.test(token); }
export function mailConfiguration() {
  const endpoint = process.env.ACCOUNT_MAIL_ENDPOINT;
  const secret = process.env.ACCOUNT_MAIL_SECRET;
  const origin = process.env.NEXTAUTH_URL;
  if (!endpoint || !secret || !origin || new URL(endpoint).protocol !== "https:" ||
      (process.env.NODE_ENV === "production" && new URL(origin).protocol !== "https:")) {
    throw new AccountInputError("Account email is temporarily unavailable.", 503);
  }
  return { endpoint, secret, origin: new URL(origin).origin };
}
export async function requestAccountToken(email: string, purpose: TokenPurpose) {
  const mail = mailConfiguration();
  const issued = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} FOR UPDATE`;
    if (!rows[0]) return null;
    const userId = rows[0].id;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (purpose === "verify" && user.emailVerifiedAt) return null;
    const recent = await tx.accountToken.findFirst({ where: { userId, purpose, createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent) return null;
    await tx.accountToken.deleteMany({ where: { userId, purpose } });
    const token = randomBytes(32).toString("hex");
    const hash = tokenHash(token);
    await tx.accountToken.create({ data: { hash, userId, purpose, expiresAt: new Date(Date.now() + (purpose === "reset" ? 30 * 60000 : 24 * 3600000)) } });
    return { token, hash };
  });
  if (!issued) return;
  try {
    // Fragment tokens stay out of access logs and referrer headers. Never log the body.
    const link = `${mail.origin}/account/recovery#${new URLSearchParams({ purpose, token: issued.token })}`;
    const response = await fetch(mail.endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mail.secret}` },
      body: JSON.stringify({ to: email, subject: purpose === "reset" ? "Reset your ThreadScout password" : "Verify your ThreadScout email", text: `Open this link to ${purpose === "reset" ? "reset your password" : "verify your email"}: ${link}\nIf you did not request this, ignore this message.` }) });
    if (!response.ok) throw new Error("Delivery failed");
  } catch {
    await prisma.accountToken.deleteMany({ where: { hash: issued.hash } });
    console.error("Account email delivery failed.");
    // Keep public reset responses independent of account existence.
  }
}
export async function consumeAccountToken(token: string, purpose: TokenPurpose, password?: unknown) {
  if (!validToken(token)) throw new AccountInputError("Invalid or expired link.");
  const passwordHash = purpose === "reset" ? await bcrypt.hash(parseSignup({ email: "reset@example.test", password }).password, 10) : undefined;
  return prisma.$transaction(async tx => {
    const hash = tokenHash(token);
    const candidate = await tx.accountToken.findUnique({ where: { hash } });
    if (!candidate) throw new AccountInputError("Invalid or expired link.");
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${candidate.userId} FOR UPDATE`;
    const removed = await tx.accountToken.deleteMany({ where: { hash, purpose, expiresAt: { gt: new Date() } } });
    if (removed.count !== 1) throw new AccountInputError("Invalid or expired link.");
    await tx.user.update({ where: { id: candidate.userId }, data: purpose === "reset"
      ? { passwordHash, sessionVersion: { increment: 1 } } : { emailVerifiedAt: new Date() } });
    await tx.accountToken.deleteMany({ where: { userId: candidate.userId, purpose } });
  });
}
export async function authenticatedAccountAction(userId: string, password: unknown, action: "delete" | "sessions" | "learning") {
  if (typeof password !== "string" || Buffer.byteLength(password) > 72) throw new AccountInputError("Current password required.", 403);
  // Check the password again under the account lock to serialize password resets/deletion.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw new AccountInputError("Current password is incorrect.", 403);
    if (action === "delete") await tx.user.delete({ where: { id: userId } });
    else if (action === "sessions") await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    else {
      await tx.interaction.deleteMany({ where: { userId } });
      await tx.banditWeights.deleteMany({ where: { userId } });
    }
  });
}
export async function purgeAccountHistory() {
  return prisma.$transaction(async tx => {
    const cutoff = new Date(Date.now() - 180 * 86400000);
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT u.id FROM users u WHERE EXISTS (SELECT 1 FROM interactions i WHERE i."userId" = u.id AND i."createdAt" < ${cutoff}) ORDER BY u.id LIMIT 100 FOR UPDATE OF u SKIP LOCKED`;
    const ids = users.map(u => u.id);
    const removed = await tx.interaction.deleteMany({ where: { userId: { in: ids }, createdAt: { lt: cutoff } } });
    await tx.banditWeights.deleteMany({ where: { userId: { in: ids } } });
    const expired = await tx.accountToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { users: ids.length, interactions: removed.count, tokens: expired.count, mayHaveMore: ids.length === 100 };
  });
}
