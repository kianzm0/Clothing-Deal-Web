import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "ThreadScout — Clothing Deal Finder",
  description: "Compare apparel prices across stores and track the best deals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
