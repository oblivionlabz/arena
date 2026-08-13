// Flags Explorer's discovery endpoint — how the Vercel Toolbar learns this
// project has flags.ts defines, so an operator can toggle them without a
// deploy. Auth is `createFlagsDiscoveryEndpoint`'s own, against FLAGS_SECRET.
import { createFlagsDiscoveryEndpoint } from "flags/next";
import { getProviderData } from "@flags-sdk/vercel";

import * as flags from "@/flags";

export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
