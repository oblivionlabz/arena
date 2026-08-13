import nextConfig from "eslint-config-next";

const config = [
  // Generated at build time by withWorkflow(), not authored here.
  { ignores: ["app/.well-known/workflow/**"] },
  // `vercel build`'s output — not source, and `.gitignore`d, but ESLint's
  // default ignores don't cover it, so a local `pnpm lint` after a local
  // `vercel build` picks up minified build chunks otherwise.
  { ignores: [".vercel/**"] },
  ...nextConfig,
];

export default config;
