"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Nav() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-700">
          ThreadScout
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-brand-600">Browse</Link>
          <Link href="/watchlist" className="hover:text-brand-600">Watchlist</Link>
          <Link href="/preferences" className="hover:text-brand-600">Preferences</Link>

          {status === "authenticated" ? (
            <span className="flex items-center gap-3">
              <span className="text-gray-400">{session.user?.email}</span>
              <button onClick={() => signOut()} className="hover:text-brand-600">
                Sign out
              </button>
            </span>
          ) : status === "loading" ? null : (
            <Link href="/login" className="hover:text-brand-600">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
