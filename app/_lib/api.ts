// Server-side access to the public API routes documented in docs/API.md.
//
// These call the real route handlers directly rather than issuing an HTTP
// request back at our own deployment. Two concrete reasons, not style:
//   1. The leaderboard and challenge-detail pages are ISR and get prerendered
//      at build time, when the deployment isn't serving yet — a self-fetch has
//      nothing to talk to and the build fails or bakes in an error page.
//   2. This project has Vercel SSO Deployment Protection on (docs/ROADMAP.md,
//      M2 exit criteria), so a self-fetch from a preview deployment answers
//      with a login wall, not JSON.
// Calling the handler keeps the route the single source of the contract —
// including the docs/SECURITY.md test-case withholding, which lives in the
// route's projection and therefore cannot be bypassed from here.
import { GET as getActive } from "@/app/api/challenges/active/route";
import { GET as getChallenge } from "@/app/api/challenges/[slug]/route";
import { GET as getLeaderboard } from "@/app/api/leaderboard/route";

export type RunStatus = "queued" | "running" | "passed" | "failed" | "error";
export type ChallengeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "completed";

export interface LeaderboardModel {
  slug: string;
  displayName: string;
  active: boolean;
  totalRuns: number;
  wins: number;
  winRate: number;
  avgTimeToSolveMs: number | null;
  currentStreak: number;
}

export interface ChallengeDetail {
  challenge: {
    id: string;
    slug: string;
    title: string;
    prompt: string;
    language: string;
    status: ChallengeStatus;
    submittedBy: string | null;
    createdAt: string;
    activatedAt: string | null;
    completedAt: string | null;
    testCaseCount: number;
    // Null until the challenge is completed — docs/SECURITY.md, "Test-case
    // confidentiality while a challenge is active". The UI never reconstructs
    // this from anywhere else.
    testCases: { input?: string; expected_output?: string }[] | null;
  };
  runs: {
    id: string;
    model: { slug: string; displayName: string; active: boolean };
    status: RunStatus;
    attemptsUsed: number;
    maxAttempts: number;
    timeToSolveMs: number | null;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
}

export interface ActiveChallenge {
  active: boolean;
  challenge: {
    id: string;
    slug: string;
    title: string;
    language: string;
    status: ChallengeStatus;
    activatedAt: string | null;
    completedAt: string | null;
    startedAt: string | null;
  } | null;
  runs: {
    id: string;
    model: { slug: string; displayName: string };
    status: RunStatus;
    attemptsUsed: number;
    maxAttempts: number;
    timeToSolveMs: number | null;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
  rotationLocked: boolean;
}

export async function fetchLeaderboard(): Promise<LeaderboardModel[]> {
  const response = await getLeaderboard();
  const body = (await response.json()) as { models: LeaderboardModel[] };
  return body.models;
}

export async function fetchChallenge(
  slug: string,
): Promise<ChallengeDetail | null> {
  const response = await getChallenge(new Request(`https://arena.local/${slug}`), {
    params: Promise.resolve({ slug }),
  });
  if (response.status === 404) return null;
  return (await response.json()) as ChallengeDetail;
}

export async function fetchActiveChallenge(): Promise<{
  data: ActiveChallenge;
  // The server's clock at the moment this snapshot was read. The live view
  // seeds its elapsed-time ticker from it so the first client render matches
  // the server's exactly — two independent Date.now() calls would not.
  fetchedAt: number;
}> {
  const response = await getActive();
  if (!response.ok) {
    // The route answers 500 when Edge Config points at a challenge row that
    // isn't there. Surfacing that as "nothing running" would be a lie, so the
    // live view gets told the truth and says so.
    throw new Error(`GET /api/challenges/active responded ${response.status}`);
  }
  return {
    data: (await response.json()) as ActiveChallenge,
    fetchedAt: Date.now(),
  };
}
