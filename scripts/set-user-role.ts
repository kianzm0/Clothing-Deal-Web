import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

const usage = "Usage: npm run user:role -- --user-id <existing-user-id> --role USER|EDITOR|ADMIN";

export function parseRoleChange(args: string[]): { userId: string; role: UserRole } {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!["--user-id", "--role"].includes(key) || values.has(key) || !value || value.startsWith("--")) {
      throw new Error(usage);
    }
    values.set(key, value);
  }
  const userId = values.get("--user-id")?.trim();
  const role = values.get("--role");
  if (!userId || (role !== "USER" && role !== "EDITOR" && role !== "ADMIN")) throw new Error(usage);
  return { userId, role };
}

// Operator-only tool: requires trusted database credentials, never web input.
// Targets one existing account by immutable ID; it cannot create an account.
export async function setUserRole(args: string[]) {
  const { userId, role } = parseRoleChange(args);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error("User not found. No account was created or changed.");
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  return { at: new Date().toISOString(), userId: user.id, email: user.email, from: user.role, to: role };
}

if (require.main === module) {
  setUserRole(process.argv.slice(2))
    .then((change) => console.log(JSON.stringify(change)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Role change failed.");
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
