import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { canEditCatalog } from "./roles";

export async function getEditorialAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { allowed: false, status: 401 } as const;

  // Read the current database role, never a body/header/JWT role claim.
  // Revocation therefore takes effect on the next editorial request.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!canEditCatalog(user?.role)) return { allowed: false, status: 403 } as const;
  return { allowed: true, userId: session.user.id } as const;
}

export async function requireEditorialAccess(): Promise<NextResponse | null> {
  try {
    const access = await getEditorialAccess();
    if (access.allowed) return null;
    return NextResponse.json(
      { error: access.status === 401 ? "Not signed in." : "Editorial access required." },
      { status: access.status }
    );
  } catch {
    // An unavailable permission store must never allow extraction or writes.
    return NextResponse.json({ error: "Unable to verify editorial access." }, { status: 503 });
  }
}
