"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);

    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border border-ink-100 bg-white p-7 shadow-card">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900">Welcome back</h1>
        <p className="mb-6 text-sm text-ink-500">Sign in to sync your watchlist and preferences.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink-900 py-2.5 font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-ink-500">
        No account? <Link href="/signup" className="font-medium text-brand-600 hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
