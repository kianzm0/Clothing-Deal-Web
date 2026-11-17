import { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

// Extends the built-in session type so `session.user.id` is typed
// without needing casts anywhere it's read.
declare module "next-auth" {
  interface User { sessionVersion?: number; }
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sessionVersion?: number;
  }
}

