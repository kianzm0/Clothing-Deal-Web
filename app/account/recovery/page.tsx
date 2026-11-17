"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function RecoveryPage() {
  const [token, setToken] = useState(""), [purpose, setPurpose] = useState("reset");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    const values = new URLSearchParams(location.hash.slice(1));
    setToken(values.get("token") ?? ""); setPurpose(values.get("purpose") === "verify" ? "verify" : "reset");
    history.replaceState(null, "", location.pathname);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, ...(token ? { token, password } : { email }) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(data.message ?? (purpose === "verify" ? "Email verified." : "Password reset. You can sign in with your new password.")); setPassword("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-sm space-y-4"><h1 className="text-2xl font-bold">{purpose === "verify" ? "Verify email" : "Reset password"}</h1>
    <form onSubmit={submit} className="space-y-4">
      {!token && <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full rounded border p-2" /></label>}
      {token && purpose === "reset" && <label>New password<input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full rounded border p-2" /></label>}
      <button disabled={busy} className="rounded bg-ink-900 px-4 py-2 text-white">{token ? "Confirm" : "Send reset link"}</button>
    </form><p role="status">{message}</p><Link href="/login" className="underline">Back to sign in</Link>
  </div>;
}
