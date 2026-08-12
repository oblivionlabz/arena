export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem", letterSpacing: "-0.02em", margin: 0 }}>
        ARENA
      </h1>
      <p style={{ color: "var(--muted)", margin: 0, maxWidth: 480 }}>
        A live, multi-model coding benchmark. Scaffold stage — the real
        leaderboard, live challenge view, and submission form land in M2.
      </p>
    </main>
  );
}
