"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Nav() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-ink-100 bg-[#faf8f5]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            T
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">ThreadScout</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium">
          <NavLink href="/">Browse</NavLink>
          <NavLink href="/watchlist">Watchlist</NavLink>
          <NavLink href="/preferences">Preferences</NavLink>

          <span className="mx-1 hidden h-4 w-px bg-ink-200 sm:inline-block" />

          {status === "authenticated" ? (
            <span className="flex items-center gap-3 pl-1">
              <span className="hidden text-ink-400 sm:inline">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="rounded-full px-3 py-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                Sign out
              </button>
            </span>
          ) : status === "loading" ? null : (
            <Link
              href="/login"
              className="rounded-full bg-ink-900 px-3.5 py-1.5 text-white transition-colors hover:bg-ink-800"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
