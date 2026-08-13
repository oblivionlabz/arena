import nextConfig from "eslint-config-next";

const config = [
  // Generated at build time by withWorkflow(), not authored here.
  { ignores: ["app/.well-known/workflow/**"] },
  ...nextConfig,
];

export default config;
