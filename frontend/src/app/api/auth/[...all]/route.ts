import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

// Standard Better Auth Next.js catch-all route: handles sign-in, sign-up,
// OAuth callbacks, session, and sign-out. No custom logic here - all
// behavior comes from the auth config in src/lib/auth/auth.ts.
export const { GET, POST } = toNextJsHandler(auth);
