// Input handling for POST /api/challenges/submit — docs/SECURITY.md's first
// untrusted input ("visitor-submitted challenge text").
//
// The order here is load-bearing: sanitize first, *then* apply length caps, so
// a body padded with zero-width or control characters can't buy itself extra
// room inside a cap that was measured before they were removed.
import { z } from "zod";

import { SUPPORTED_LANGUAGE } from "@/lib/workflow/config";

/** Whole-body cap, enforced while reading. Generous against any real submission. */
export const MAX_BODY_BYTES = 32_768;

export const TITLE_MIN = 8;
export const TITLE_MAX = 120;
export const PROMPT_MIN = 40;
export const PROMPT_MAX = 4_000;
export const HANDLE_MAX = 60;
export const SLUG_MAX = 60;

// C0/C1 controls except tab and newline. Strips NUL, ESC, and the rest of the
// bytes that have no meaning in a prompt but plenty of meaning in a terminal
// or a log viewer.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

// Zero-width and bidirectional-override characters. These are invisible in
// every review surface a moderator would use, which is the entire point of the
// Trojan Source class of attack — text that reads one way to a human and
// another way to whatever consumes it.
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Chat-template role delimiters. docs/SECURITY.md requires this text never look
// like it's overriding the benchmark instructions; lib/workflow/steps/model.ts
// already keeps it in the user message rather than the system prompt, but a
// forged role boundary inside that message is the way around that, so the
// delimiters themselves are neutralized on write.
const ROLE_DELIMITERS = [
  /<\|[^|<>]{0,64}\|>/g, // ChatML / Llama 3: <|im_start|>, <|eot_id|>, ...
  /\[\/?INST\]/gi, // Llama 2 instruction markers
  /<<\/?SYS>>/gi, // Llama 2 system markers
  /<\/?s>/gi, // sentence-boundary tokens
];

// Active-content HTML. The title and prompt are displayed publicly once
// approved, and docs/SECURITY.md wants that handled on write rather than
// relying only on the renderer. Ordinary angle brackets are deliberately left
// alone — `List<int>` is legitimate content in a coding challenge and mangling
// it would corrupt the benchmark prompt — so only constructs that can actually
// execute get defanged, by escaping the opening bracket rather than deleting
// the text (a moderator should still see what was submitted).
const ACTIVE_HTML =
  /<(\/?\s*(?:script|iframe|object|embed|style|svg|link|meta|base|form|applet)\b)/gi;
const EVENT_HANDLER = /\bon[a-z]{3,20}\s*=/gi;

const COMBINING_MARKS = /[\u0300-\u036F]/g;

function defang(value: string): string {
  let out = value.normalize("NFC").replace(/\r\n?/g, "\n");
  out = out.replace(CONTROL_CHARS, "").replace(INVISIBLE_CHARS, "");
  for (const pattern of ROLE_DELIMITERS) out = out.replace(pattern, " ");
  out = out.replace(ACTIVE_HTML, "&lt;$1").replace(EVENT_HANDLER, (m) => m.replace("=", "&#61;"));
  return out;
}

/** For fields that are one line by definition: title, handle. */
export function toSingleLine(value: string): string {
  return defang(value).replace(/\s+/g, " ").trim();
}

/** For the prompt: paragraphs survive, runaway blank space doesn't. */
export function toPlainText(value: string): string {
  return defang(value)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Slug candidate from a title. Diacritics are folded rather than dropped, and a
 * title with no ASCII-able characters at all still yields something the caller
 * can suffix into uniqueness.
 */
export function slugFromTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, "");
  return slug || "challenge";
}

const rawSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  // v1 is single-language per docs/PRODUCT.md; the constant is imported rather
  // than restated so this can't drift from what the Sandbox can actually run.
  language: z.string().optional(),
  submittedBy: z.string().optional(),
});

const sanitizedSchema = z.object({
  title: z.string().min(TITLE_MIN).max(TITLE_MAX),
  prompt: z.string().min(PROMPT_MIN).max(PROMPT_MAX),
  language: z.literal(SUPPORTED_LANGUAGE),
  submittedBy: z.string().max(HANDLE_MAX).nullable(),
});

export type Submission = z.infer<typeof sanitizedSchema>;

export type ValidationResult =
  | { ok: true; value: Submission }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

export function validateSubmission(body: unknown): ValidationResult {
  const raw = rawSchema.safeParse(body);
  if (!raw.success) {
    return { ok: false, fieldErrors: raw.error.flatten().fieldErrors };
  }

  const handle = raw.data.submittedBy === undefined ? null : toSingleLine(raw.data.submittedBy);
  const sanitized = sanitizedSchema.safeParse({
    title: toSingleLine(raw.data.title),
    prompt: toPlainText(raw.data.prompt),
    language: (raw.data.language ?? SUPPORTED_LANGUAGE).trim().toLowerCase(),
    submittedBy: handle || null,
  });
  if (!sanitized.success) {
    return { ok: false, fieldErrors: sanitized.error.flatten().fieldErrors };
  }

  return { ok: true, value: sanitized.data };
}
