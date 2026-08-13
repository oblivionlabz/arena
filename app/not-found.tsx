import Link from "next/link";

import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={`shell ${styles.page}`}>
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>Nothing here.</h1>
      <p className={styles.body}>
        Challenges that are still pending moderation aren&apos;t public, so a
        link to one looks exactly like a link to nothing.
      </p>
      <Link href="/" className={styles.link}>
        Back to the standings →
      </Link>
    </main>
  );
}
