import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Arena — a live, multi-model coding benchmark",
    template: "%s — Arena",
  },
  description:
    "A live, multi-model coding benchmark. Every submission runs for real before it gets a score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="siteRail">
          <div className="shell siteRailInner">
            <Link href="/" className="wordmark">
              Arena
            </Link>
            <nav className="siteNav">
              <Link href="/">Standings</Link>
              <Link href="/live" className="liveLink">
                <span className="pulseDot" aria-hidden="true" />
                Live
              </Link>
              <Link href="/submit">Submit</Link>
            </nav>
          </div>
        </header>

        {children}

        <footer className="siteFoot">
          <div className="shell siteFootInner">
            <span>
              Every submission executes in an isolated sandbox before it scores.
            </span>
            <span>Challenge rotation: daily, 00:00 UTC</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
