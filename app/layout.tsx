import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ThreadScout — Clothing Deal Finder",
  description: "Compare apparel prices across stores and track the best deals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
