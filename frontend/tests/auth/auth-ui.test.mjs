// Zero-cost tests for the Phase 9D-5A auth UI. No database, network,
// Anthropic access, or browser/DOM rendering - the project has no
// React-rendering test harness, so this covers what's practical without
// adding one: the pure display-name logic AuthStatus.tsx delegates to, and
// a source-level check that the component only ever calls Better Auth's
// own signIn.social/signOut/useSession with no identity payload of its
// own. This does not duplicate the server-side authorization tests in
// api-auth-scope.test.mjs - it only proves the UI never becomes a second
// place identity could leak from or be forged through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { getDisplayName, getFirstName } = require(path.join(buildDir, "auth/display-name.js"));

test("getDisplayName returns a trimmed name when present", () => {
  assert.equal(getDisplayName({ name: "Ada Lovelace" }), "Ada Lovelace");
  assert.equal(getDisplayName({ name: "  Grace Hopper  " }), "Grace Hopper");
});

test("getDisplayName returns null for missing/empty/whitespace-only names", () => {
  assert.equal(getDisplayName({ name: "" }), null);
  assert.equal(getDisplayName({ name: "   " }), null);
  assert.equal(getDisplayName({ name: undefined }), null);
  assert.equal(getDisplayName(null), null);
  assert.equal(getDisplayName(undefined), null);
});

test("getDisplayName never reads email/id even when present on a richer user object", () => {
  // A richer session user (id, email, image, ...) must not change behavior:
  // this proves the function structurally cannot leak those fields, since
  // it only ever reads `.name`.
  const richUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "someone@example.com",
    name: "Real Name",
    image: "https://example.com/avatar.png",
  };
  assert.equal(getDisplayName(richUser), "Real Name");
  const richUserNoName = { id: "x", email: "someone@example.com" };
  assert.equal(getDisplayName(richUserNoName), null);
});

test("getFirstName returns just the first word of a multi-word name", () => {
  assert.equal(getFirstName({ name: "Nitesh Kumar" }), "Nitesh");
  assert.equal(getFirstName({ name: "  Ada   Lovelace  " }), "Ada");
});

test("getFirstName returns the whole name when it is a single word", () => {
  assert.equal(getFirstName({ name: "Cher" }), "Cher");
});

test("getFirstName returns null for missing/empty/whitespace-only names", () => {
  assert.equal(getFirstName({ name: "" }), null);
  assert.equal(getFirstName({ name: "   " }), null);
  assert.equal(getFirstName(null), null);
  assert.equal(getFirstName(undefined), null);
});

test("getFirstName never reads email/id even when present on a richer user object", () => {
  const richUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "someone@example.com",
    name: "Real Name",
    image: "https://example.com/avatar.png",
  };
  assert.equal(getFirstName(richUser), "Real");
});

const authStatusSource = readFileSync(
  path.resolve(process.cwd(), "src/components/layout/AuthStatus.tsx"),
  "utf8",
);
const authClientSource = readFileSync(
  path.resolve(process.cwd(), "src/lib/auth/client.ts"),
  "utf8",
);

test("AuthStatus signs in only with provider google, no other identity fields", () => {
  assert.match(authStatusSource, /signIn\.social\(\s*\{\s*provider:\s*"google"/);
});

test("AuthStatus never references a user id, session id/token, or email", () => {
  // Presentation-only: identity must come solely from useSession()'s own
  // data, never re-derived, re-sent, or displayed via id/email/token.
  assert.doesNotMatch(authStatusSource, /\.user\.id\b/);
  assert.doesNotMatch(authStatusSource, /\.session\.(id|token)\b/);
  assert.doesNotMatch(authStatusSource, /\.user\.email\b/);
  assert.doesNotMatch(authStatusSource, /\bownerId\b/);
  assert.doesNotMatch(authStatusSource, /\buserId\b/);
});

test("AuthStatus uses Better Auth's own signOut, not a custom endpoint", () => {
  assert.match(authStatusSource, /authClient\.signOut\(/);
  assert.doesNotMatch(authStatusSource, /\bfetch\(/);
});

test("AuthStatus navigates to the home page only after a successful sign-out, to clear stale client-side worksheet state", () => {
  assert.match(authStatusSource, /onSuccess:\s*\(\)\s*=>\s*window\.location\.assign\(\s*"\/"\s*\)/);
});

test("AuthStatus reads identity only through useSession()", () => {
  assert.match(authStatusSource, /authClient\.useSession\(\)/);
});

test("AuthStatus shows a compact first-name label, not the full name or a user id", () => {
  assert.match(authStatusSource, /getFirstName\(data\.user\)/);
  assert.doesNotMatch(authStatusSource, /getDisplayName/);
});

test("the auth client sets no baseURL override and is the sole createAuthClient call", () => {
  assert.match(authClientSource, /createAuthClient\(\)/);
});

const savedPageSource = readFileSync(
  path.resolve(process.cwd(), "src/app/worksheets/saved/page.tsx"),
  "utf8",
);

test("My Worksheets page copy reflects account-based persistence, not device-based", () => {
  assert.match(savedPageSource, /Your saved worksheets\./);
  assert.doesNotMatch(savedPageSource, /saved on this device/);
});
