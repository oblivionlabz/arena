"use client";

import { useState } from "react";

import styles from "./challenge.module.css";

/** Resets on its own — no dismiss button needed for a label that reverts itself. */
const CONFIRM_MS = 1600;

export function CopyPromptButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch {
      // Clipboard access denied or unavailable (permissions, insecure
      // context) — the prompt is still selectable text right above this
      // button, so there's a fallback in the page itself. Nothing to show
      // here that the user couldn't already tell from nothing happening.
    }
  }

  return (
    <button type="button" className={styles.copyButton} onClick={onClick}>
      {copied ? "Copied" : "Copy prompt"}
    </button>
  );
}
