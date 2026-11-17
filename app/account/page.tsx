"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
export default function AccountPage() {
  const { data: session, status } = useSession();
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(action === "verify" ? "/api/account/token" : "/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "verify" ? { purpose: "verify" } : { action, password, confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPassword("");
      if (action === "delete" || action === "sessions") { await signOut({ callbackUrl: "/login" }); return; }
      setMessage(data.message ?? "Learning history reset. Reload Browse to use fresh recommendations.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (status === "loading") return <p>Loading account…</p>;
  if (!session?.user?.id) return <Link href="/login">Sign in to manage your account</Link>;
  return <div className="mx-auto max-w-lg space-y-5">
    <h1 className="text-2xl font-bold">Your account</h1>
    <p>{session.user.email}</p>
    <button disabled={busy} onClick={() => void act("verify")} className="underline">Send email verification link</button>
    <p><a className="underline" href="/api/account/export">Download your account data</a></p>
    <p>Learning history is retained for 180 days and removed by scheduled cleanup. You can reset it now without changing your saved items or explicit preferences.</p>
    <label className="block">Current password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full rounded border p-2" /></label>
    <button disabled={busy || !password} onClick={() => void act("learning")} className="block underline">Reset learning history</button>
    <button disabled={busy || !password} onClick={() => void act("sessions")} className="block underline">Sign out all sessions</button>
    <div className="rounded border border-red-200 p-4 space-y-3"><p>Delete your account permanently, including saved items, preferences and activity. This cannot be undone.</p>
      <label>Type DELETE to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} className="block w-full rounded border p-2" /></label>
      <button disabled={busy || !password || confirmation !== "DELETE"} onClick={() => void act("delete")} className="text-red-700 underline">Delete account</button>
    </div>
    <p role="status">{message}</p>
  </div>;
}
