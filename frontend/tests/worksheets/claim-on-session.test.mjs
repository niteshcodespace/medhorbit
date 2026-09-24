// Zero-cost tests for the Phase 9D-3B claim-on-session integration boundary
// (src/lib/auth/worksheet-claim-hook.ts). No database, Docker, network, or
// Anthropic access, and no Better Auth internals are mocked - the hook
// itself only depends on a `{ userId }` session shape and a
// `{ getCookie }` context shape, both satisfied here with plain fixtures,
// plus the real InMemoryWorksheetRepository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryWorksheetRepository } = require(path.join(buildDir, "worksheets/memory-repository.js"));
const { claimWorksheetsOnSessionCreated } = require(path.join(buildDir, "auth/worksheet-claim-hook.js"));

const WORKSHEET_SESSION_COOKIE = "medhorbit_worksheet_session";

const makeInput = (anonymousId = "anon-a", overrides = {}) => ({
  anonymousId,
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 2,
  questions: [
    { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
    { id: "q2", prompt: "What is 10 - 4?", type: "short-answer", answer: "6" },
  ],
  generatedAt: new Date("2026-09-21T10:00:00.000Z"),
  ...overrides,
});

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const VALID_ANON_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

// A minimal stand-in for Better Auth's EndpointContext: only getCookie is
// read by the hook. cookies is a plain map, like a parsed Cookie header.
const contextWithCookies = (cookies) => ({
  getCookie: (key) => (Object.prototype.hasOwnProperty.call(cookies, key) ? cookies[key] : null),
});

test("successful authenticated context + valid anonymous cookie invokes claim with correct anonymousId and user.id", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: VALID_ANON_ID });

  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);

  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(found.id, saved.id);
});

test("ownerId is sourced from the authenticated session, not from cookies or request data", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  // The context carries no ownerId at all - only a cookie. The hook must
  // never derive ownerId from anything but session.userId.
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: VALID_ANON_ID });

  await claimWorksheetsOnSessionCreated({ userId: OWNER_B }, context, repo);

  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_A), null);
  const found = await repo.getByIdForOwner(saved.id, OWNER_B);
  assert.equal(found.id, saved.id);
});

test("absent anonymous cookie performs no claim", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  const context = contextWithCookies({}); // no cookie at all

  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);

  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_A), null);
  const stillAnonymous = await repo.getByIdForAnonymousOwner(saved.id, VALID_ANON_ID);
  assert.equal(stillAnonymous.id, saved.id);
});

test("malformed/invalid anonymous cookie performs no claim", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: "not-a-uuid; DROP TABLE worksheets;" });

  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);

  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_A), null);
  const stillAnonymous = await repo.getByIdForAnonymousOwner(saved.id, VALID_ANON_ID);
  assert.equal(stillAnonymous.id, saved.id);
});

test("null context (no request available) performs no claim and does not throw", async () => {
  const repo = new InMemoryWorksheetRepository();
  await repo.save(makeInput(VALID_ANON_ID));
  await assert.doesNotReject(() => claimWorksheetsOnSessionCreated({ userId: OWNER_A }, null, repo));
  assert.deepEqual(await repo.listByOwnerId(OWNER_A), []);
});

test("repeated hook execution remains safe: second call claims nothing further", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: VALID_ANON_ID });

  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);
  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);

  const list = await repo.listByOwnerId(OWNER_A);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
});

test("repeated hook execution by a different owner cannot steal an already-claimed worksheet", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: VALID_ANON_ID });

  await claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, repo);
  await claimWorksheetsOnSessionCreated({ userId: OWNER_B }, context, repo);

  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_B), null);
  const stillOwnerA = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(stillOwnerA.id, saved.id);
});

test("claim failure policy: a repository error is swallowed, never thrown, and never fails the caller", async () => {
  const throwingRepo = {
    async save() {
      throw new Error("should not be called");
    },
    async listByAnonymousId() {
      return [];
    },
    async getByIdForAnonymousOwner() {
      return null;
    },
    async listByOwnerId() {
      return [];
    },
    async getByIdForOwner() {
      return null;
    },
    async claimAnonymousWorksheets() {
      throw new Error("simulated transient DB failure - must never surface to auth");
    },
  };
  const context = contextWithCookies({ [WORKSHEET_SESSION_COOKIE]: VALID_ANON_ID });

  await assert.doesNotReject(() =>
    claimWorksheetsOnSessionCreated({ userId: OWNER_A }, context, throwingRepo),
  );
});

test("existing anonymous save() behavior is unchanged by the presence of this hook", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save(makeInput(VALID_ANON_ID));
  assert.equal(saved.anonymousId, VALID_ANON_ID);
  const found = await repo.getByIdForAnonymousOwner(saved.id, VALID_ANON_ID);
  assert.deepEqual(found, saved);
});

test("no public claim endpoint exists under src/app/api", async () => {
  const { readdirSync, existsSync } = require("node:fs");
  const apiDir = path.resolve(process.cwd(), "src/app/api");
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  };
  assert.ok(existsSync(apiDir), "src/app/api should exist");
  const routeFiles = walk(apiDir).filter((f) => f.endsWith("route.ts"));
  const claimRoutes = routeFiles.filter((f) => /claim/i.test(f));
  assert.deepEqual(claimRoutes, []);
});
