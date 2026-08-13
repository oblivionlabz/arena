import type { Metadata } from "next";

import { ModerationPanel } from "./moderation-panel";
import styles from "./moderate.module.css";

// Not linked from the public nav and not indexed — reachable only if you
// know the URL, same as any unlisted admin tool. The actual protection is
// the token every request needs (lib/internal/auth.ts); this is just not
// advertising the page exists on top of that.
export const metadata: Metadata = {
  title: "Moderate",
  robots: { index: false, follow: false },
};

export default function ModeratePage() {
  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.head}>
        <p className="eyebrow">Operator</p>
        <h1 className={styles.title}>Moderation queue.</h1>
        <p className={styles.thesis}>
          Approve a submission to write its test cases and put it in the
          rotation queue, or reject it. Nothing here is public — a pending
          challenge is invisible everywhere else on the site until this
          decides otherwise.
        </p>
      </div>

      <ModerationPanel />
    </main>
  );
}
