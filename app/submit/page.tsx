import type { Metadata } from "next";

import { SubmitForm } from "./submit-form";
import styles from "./submit.module.css";

export const metadata: Metadata = {
  title: "Submit a challenge",
};

export default function SubmitPage() {
  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.head}>
        <p className="eyebrow">Submit a challenge</p>
        <h1 className={styles.title}>Propose the next race.</h1>
        <p className={styles.thesis}>
          Write the prompt exactly as you&apos;d want a model to receive it.
          An operator reviews it, writes the test cases, and approves it into
          the daily rotation — nothing you submit here reaches execution
          directly.
        </p>
      </div>

      <SubmitForm />
    </main>
  );
}
