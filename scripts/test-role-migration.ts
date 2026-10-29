import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { prisma } from "../lib/prisma";

// This is run only against the disposable Postgres service in CI.
async function main() {
  if (process.env.AUTHORIZATION_TEST_DATABASE !== "1") throw new Error("Requires a disposable authorization test database.");
  const legacy = await prisma.user.findUniqueOrThrow({ where: { id: "authorization-test-legacy" } });
  assert.equal(legacy.role, "USER");
  assert.equal(legacy.passwordHash, "unchanged-test-hash");
  const fresh = await prisma.user.create({ data: {
    id: "authorization-test-new", email: "new@authorization.test", passwordHash: "test-only",
  } });
  assert.equal(fresh.role, "USER");

  function runRole(userId: string, role: string) {
    return spawnSync(process.execPath, ["--import", "tsx", "scripts/set-user-role.ts", "--user-id", userId, "--role", role], {
      encoding: "utf8", env: process.env,
    });
  }
  for (const role of ["EDITOR", "ADMIN", "USER"] as const) {
    const result = runRole(legacy.id, role);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).to, role);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } })).role, role);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: fresh.id } })).role, "USER");
  }
  assert.equal(runRole("authorization-test-missing", "ADMIN").status, 1);
  assert.equal(runRole(fresh.id, "OWNER").status, 1);
  assert.equal(await prisma.user.count({ where: { role: { in: ["EDITOR", "ADMIN"] } } }), 0);
  await prisma.user.deleteMany({ where: { id: { in: [legacy.id, fresh.id] } } });
  console.log("Migration defaults and explicit role grants/revocation verified.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
