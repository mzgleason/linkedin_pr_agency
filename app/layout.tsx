import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn PR Agency",
  description: "Content ops + PR agency workflow"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6">
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">LinkedIn PR Agency</div>
              <div className="text-xs text-neutral-500">Mobile-first scaffold</div>
            </div>
            <nav className="flex shrink-0 items-center gap-3 text-sm">
              <Link className="text-neutral-600 hover:text-neutral-900" href="/">
                Home
              </Link>
              <Link className="text-neutral-600 hover:text-neutral-900" href="/inbox">
                Inbox
              </Link>
              <Link className="text-neutral-600 hover:text-neutral-900" href="/api/health">
                Health
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
            Built on Next.js + Tailwind
          </footer>
        </div>
      </body>
    </html>
  );
}
