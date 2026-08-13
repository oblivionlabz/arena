"use client";

import { useState, type FormEvent } from "react";

import {
  HANDLE_MAX,
  PROMPT_MAX,
  PROMPT_MIN,
  TITLE_MAX,
  TITLE_MIN,
} from "@/app/api/challenges/submit/validation";

import styles from "./submit.module.css";

// The only language docs/PRODUCT.md puts in v1 scope — imported rather than
// hardcoded so a future language addition can't silently drift the copy
// below out of sync with what the endpoint actually accepts.
import { SUPPORTED_LANGUAGE } from "@/lib/workflow/config";

type Status = "idle" | "submitting" | "success" | "error";

interface FieldErrors {
  title?: string[];
  prompt?: string[];
  submittedBy?: string[];
}

const initialFields = { title: "", prompt: "", submittedBy: "" };

export function SubmitForm() {
  const [fields, setFields] = useState(initialFields);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/challenges/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: fields.title,
          prompt: fields.prompt,
          // Omitted rather than sent empty — the route treats a missing
          // handle and an empty one the same way, but this keeps the wire
          // body honest about what the visitor actually typed.
          submittedBy: fields.submittedBy.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        slug?: string;
        error?: string;
        fields?: FieldErrors;
      } | null;

      if (response.status === 201 && body?.slug) {
        setSlug(body.slug);
        setStatus("success");
        return;
      }

      if (response.status === 400 && body?.fields) {
        setFieldErrors(body.fields);
        setFormError("Fix the highlighted fields and try again.");
        setStatus("error");
        return;
      }

      if (response.status === 409) {
        setFieldErrors({ title: ["That title's taken — try a more specific one."] });
        setFormError("Fix the highlighted fields and try again.");
        setStatus("error");
        return;
      }

      setFormError(
        body?.error ?? `Submission failed (HTTP ${response.status}). Try again.`,
      );
      setStatus("error");
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success" && slug) {
    return (
      <div className={`${styles.panel} rise`}>
        <p className="eyebrow">Submitted</p>
        <h2 className={styles.panelTitle}>In the moderation queue.</h2>
        <p className={styles.panelBody}>
          <code className={styles.slug}>{slug}</code> is saved as{" "}
          <code className={styles.slug}>pending</code>. An operator writes its
          test cases and approves it before it&apos;s eligible for the daily
          rotation — it won&apos;t appear on the site until then.
        </p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setFields(initialFields);
            setSlug(null);
            setStatus("idle");
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <span className={styles.count}>
            {fields.title.length}/{TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          name="title"
          type="text"
          className={styles.input}
          value={fields.title}
          maxLength={TITLE_MAX}
          placeholder="e.g. Merge overlapping intervals in one pass"
          required
          disabled={submitting}
          onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "title-error" : "title-hint"}
        />
        {fieldErrors.title ? (
          <p id="title-error" className={styles.error}>
            {fieldErrors.title.join(" ")}
          </p>
        ) : (
          <p id="title-hint" className={styles.hint}>
            At least {TITLE_MIN} characters. Short and specific reads best on
            the standings page.
          </p>
        )}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label htmlFor="prompt" className={styles.label}>
            Prompt
          </label>
          <span className={styles.count}>
            {fields.prompt.length}/{PROMPT_MAX}
          </span>
        </div>
        <textarea
          id="prompt"
          name="prompt"
          className={styles.textarea}
          value={fields.prompt}
          maxLength={PROMPT_MAX}
          rows={8}
          placeholder="Describe the problem exactly as every model should see it — this text is sent verbatim, unmodified, to each one."
          required
          disabled={submitting}
          onChange={(e) => setFields((f) => ({ ...f, prompt: e.target.value }))}
          aria-invalid={Boolean(fieldErrors.prompt)}
          aria-describedby={fieldErrors.prompt ? "prompt-error" : "prompt-hint"}
        />
        {fieldErrors.prompt ? (
          <p id="prompt-error" className={styles.error}>
            {fieldErrors.prompt.join(" ")}
          </p>
        ) : (
          <p id="prompt-hint" className={styles.hint}>
            At least {PROMPT_MIN} characters. Test cases aren&apos;t submitted
            here — an operator writes those during moderation.
          </p>
        )}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label htmlFor="submittedBy" className={styles.label}>
            Handle <span className={styles.optional}>optional</span>
          </label>
          <span className={styles.count}>
            {fields.submittedBy.length}/{HANDLE_MAX}
          </span>
        </div>
        <input
          id="submittedBy"
          name="submittedBy"
          type="text"
          className={styles.input}
          value={fields.submittedBy}
          maxLength={HANDLE_MAX}
          placeholder="How you'd like to be credited, if approved"
          disabled={submitting}
          onChange={(e) =>
            setFields((f) => ({ ...f, submittedBy: e.target.value }))
          }
          aria-invalid={Boolean(fieldErrors.submittedBy)}
        />
        {fieldErrors.submittedBy && (
          <p className={styles.error}>{fieldErrors.submittedBy.join(" ")}</p>
        )}
      </div>

      <div className={styles.langNote}>
        Runs in <strong>{SUPPORTED_LANGUAGE}</strong> — the only language Arena
        supports right now.
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
        {formError && <p className={styles.formError}>{formError}</p>}
      </div>
    </form>
  );
}
