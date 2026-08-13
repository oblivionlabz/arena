import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";

import { NavLiveIndicator } from "@/app/_components/nav-live-indicator";

import "./globals.css";

// The one typographic decision this redesign hinges on: display headings
// get a real face with character instead of setting everything — labels,
// numerals, and headlines alike — in the same monospace stack. The
// monospace identity stays for data/readouts (see globals.css), which is
// still the right choice there; it was never the right choice for a 60px
// headline.
const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

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
    <html lang="en" className={displayFont.variable}>
      <body>
        <header className="siteRail">
          <div className="shell siteRailInner">
            <Link href="/" className="wordmark">
              Arena
            </Link>
            <nav className="siteNav">
              <Link href="/">Standings</Link>
              <Link href="/live" className="liveLink">
                <NavLiveIndicator />
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
