import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Required for the "use workflow" / "use step" directives in lib/workflow/ to
// compile — without it, start() rejects the workflow function at runtime.
export default withWorkflow(nextConfig);
