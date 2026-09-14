import { DefaultSession } from "next-auth";

// Extends the built-in session type so `session.user.id` is typed
// without needing casts anywhere it's read.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
