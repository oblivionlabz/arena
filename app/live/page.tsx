import type { Metadata } from "next";
import Link from "next/link";

import { fetchActiveChallenge } from "@/app/_lib/api";

import { LiveView } from "./live-view";
import styles from "./live.module.css";

export const metadata: Metadata = { title: "Live" };

// The one page that isn't ISR. Its data is the current state of a race, and
// the API route behind it is explicitly no-store — caching this would be
// caching the thing the page exists to show changing.
export const dynamic = "force-dynamic";

export default async function LivePage() {
  let snapshot;
  try {
    snapshot = await fetchActiveChallenge();
  } catch {
    // GET /api/challenges/active answers 500 when Edge Config's pointer names
    // a challenge row that doesn't exist. That's an operator-visible fault,
    // not "no challenge running" — say which one it is.
    return (
      <main className={`shell ${styles.page}`}>
        <section className={`${styles.panel} ${styles.alarm} floating`}>
          <p className="eyebrow">Live view unavailable</p>
          <h1 className={styles.panelTitle}>
            The current-challenge feed isn&apos;t answering.
          </h1>
          <p className={styles.panelBody}>
            This is a fault in the rotation state, not a quiet day — the site
            can&apos;t tell you whether a challenge is running right now. The
            standings are unaffected and still accurate.
          </p>
          <div className={styles.panelActions}>
            <Link href="/" className={styles.detailLink}>
              See the standings →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`shell ${styles.page}`}>
      <LiveView initial={snapshot.data} fetchedAt={snapshot.fetchedAt} />
    </main>
  );
}
