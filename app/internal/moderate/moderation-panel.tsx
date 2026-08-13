"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./moderate.module.css";

// sessionStorage, not localStorage: this is a bearer credential for a write
// endpoint, and the tab closing is a reasonable moment to forget it. Not
// sent anywhere but this app's own /api/internal/* routes.
const TOKEN_KEY = "arena.internal_token";

interface PendingChallenge {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  language: string;
  submittedBy: string | null;
  createdAt: string;
}

type FetchState = "idle" | "loading" | "error";

export function ModerationPanel() {
  // Lazy initializer, not an effect: reading sessionStorage is a synchronous
  // read of an external system available at first render, so there's no
  // "external system changed, sync state to it" effect to write here.
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : sessionStorage.getItem(TOKEN_KEY),
  );
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [challenges, setChallenges] = useState<PendingChallenge[] | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [listError, setListError] = useState<string | null>(null);

  const load = useCallback(async (currentToken: string) => {
    setState("loading");
    setListError(null);
    try {
      const response = await fetch("/api/internal/challenges/pending", {
        headers: { authorization: `Bearer ${currentToken}` },
        cache: "no-store",
      });
      if (response.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setTokenError("That token was rejected. Try again.");
        setState("idle");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { challenges: PendingChallenge[] };
      setChallenges(body.challenges);
      setState("idle");
    } catch {
      setListError("Couldn't load the queue. Check your connection and retry.");
      setState("error");
    }
  }, []);

  // Fires on mount (token seeded from sessionStorage above) and again
  // whenever a new token is set — one place kicks off the fetch, instead of
  // duplicating the "load after setting a token" call at every call site.
  // `load`'s first statement is a setState, and calling it directly here
  // would run that synchronously inside the effect's own commit — queueing
  // it as a microtask keeps the state update in a callback, not the effect
  // body itself, which is what react-hooks/set-state-in-effect is checking.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(token);
    });
    return () => {
      cancelled = true;
    };
  }, [token, load]);

  function onSubmitToken(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    setTokenError(null);
    sessionStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setChallenges(null);
  }

  if (!token) {
    return (
      <form className={styles.tokenForm} onSubmit={onSubmitToken}>
        <label htmlFor="token" className={styles.label}>
          Internal token
        </label>
        <input
          id="token"
          type="password"
          className={styles.input}
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          autoComplete="off"
          placeholder="INTERNAL_TOKEN"
        />
        {tokenError && <p className={styles.error}>{tokenError}</p>}
        <button type="submit" className={styles.submit}>
          Continue
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {challenges === null ? "Loading…" : `${challenges.length} pending`}
        </span>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void load(token)}
            disabled={state === "loading"}
          >
            {state === "loading" ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className={styles.secondary} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {listError && <p className={styles.error}>{listError}</p>}

      {challenges !== null && challenges.length === 0 && (
        <p className={styles.empty}>Nothing waiting on moderation.</p>
      )}

      {challenges !== null && challenges.length > 0 && (
        <ul className={styles.queue}>
          {challenges.map((challenge) => (
            <QueueItem
              key={challenge.id}
              challenge={challenge}
              token={token}
              onResolved={(id) =>
                setChallenges((prev) => prev?.filter((c) => c.id !== id) ?? null)
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueItem({
  challenge,
  token,
  onResolved,
}: {
  challenge: PendingChallenge;
  token: string;
  onResolved: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testCasesInput, setTestCasesInput] = useState(
    '[\n  { "input": "", "expected_output": "" }\n]',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function moderate(body: { action: "approve"; testCases: unknown } | { action: "reject" }) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/internal/challenges/${challenge.id}/moderate`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const responseBody = (await response.json().catch(() => null)) as {
        error?: string;
        issues?: unknown;
      } | null;
      if (!response.ok) {
        setError(responseBody?.error ?? `HTTP ${response.status}`);
        setSubmitting(false);
        return;
      }
      onResolved(challenge.id);
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  }

  function onApprove() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(testCasesInput);
    } catch {
      setError("Test cases must be valid JSON.");
      return;
    }
    void moderate({ action: "approve", testCases: parsed });
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <div>
          <p className={styles.itemTitle}>{challenge.title}</p>
          <p className={styles.itemMeta}>
            {challenge.language} · {challenge.submittedBy ?? "anonymous"} ·{" "}
            {new Date(challenge.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={styles.slug}>{challenge.slug}</span>
      </div>

      <p className={styles.itemPrompt}>{challenge.prompt}</p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.itemActions}>
        {expanded ? (
          <div className={styles.approveForm}>
            <label htmlFor={`cases-${challenge.id}`} className={styles.label}>
              Test cases (JSON array of {"{ input, expected_output }"})
            </label>
            <textarea
              id={`cases-${challenge.id}`}
              className={styles.textarea}
              rows={6}
              value={testCasesInput}
              onChange={(e) => setTestCasesInput(e.target.value)}
              disabled={submitting}
            />
            <div className={styles.approveActions}>
              <button
                type="button"
                className={styles.submit}
                onClick={onApprove}
                disabled={submitting}
              >
                {submitting ? "Approving…" : "Confirm approve"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setExpanded(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={styles.submit}
              onClick={() => setExpanded(true)}
              disabled={submitting}
            >
              Approve…
            </button>
            <button
              type="button"
              className={styles.reject}
              onClick={() => void moderate({ action: "reject" })}
              disabled={submitting}
            >
              {submitting ? "Rejecting…" : "Reject"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
