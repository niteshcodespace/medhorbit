// Zero-cost tests for the Phase 9D-4B auth-aware API scope selection: the
// real scoped-access.ts functions (the same ones the actual route handlers
// call) plus InMemoryWorksheetRepository. No database, Docker, network, or
// Anthropic access, and no Better Auth/Next.js runtime is needed, because
// scoped-access.ts takes ownerId as a plain parameter rather than deriving
// it itself - the route handlers are the only place that calls
// auth.api.getSession, and this is the DI seam that lets everything below
// it stay deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryWorksheetRepository } = require(path.join(buildDir, "worksheets/memory-repository.js"));
const { validateSaveRequest } = require(path.join(buildDir, "worksheets/save-validator.js"));
const {
  saveWorksheetScoped,
  listWorksheetsScoped,
  getWorksheetScoped,
} = require(path.join(buildDir, "worksheets/scoped-access.js"));

const makeBody = (overrides = {}) => ({
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 2,
  questions: [
    { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
    { id: "q2", prompt: "What is 10 - 4?", type: "short-answer", answer: "6" },
  ],
  generatedAt: "2026-09-21T10:00:00.000Z",
  ...overrides,
});

// Mirrors the POST handler's validate -> scoped-save pipeline exactly,
// minus the HTTP/cookie layer.
async function postViaHandler(repo, anonymousId, ownerId, body) {
  const error = validateSaveRequest(body);
  if (error) return { error };
  const saved = await saveWorksheetScoped(
    repo,
    { ...body, anonymousId, generatedAt: new Date(body.generatedAt) },
    ownerId,
  );
  return { data: saved };
}

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

test("anonymous POST still saves anonymously (ownerId null)", async () => {
  const repo = new InMemoryWorksheetRepository();
  const { data } = await postViaHandler(repo, "anon-a", null, makeBody());
  assert.equal(data.anonymousId, "anon-a");
  const stillAnonymous = await repo.getByIdForAnonymousOwner(data.id, "anon-a");
  assert.equal(stillAnonymous.id, data.id);
});

test("authenticated POST uses saveForOwner, not save()", async () => {
  const repo = new InMemoryWorksheetRepository();
  const { data } = await postViaHandler(repo, "anon-a", OWNER_A, makeBody());
  // If save() (anonymous) had been used instead, this would be null.
  const found = await repo.getByIdForOwner(data.id, OWNER_A);
  assert.equal(found.id, data.id);
  // And it must NOT be reachable through the anonymous path.
  assert.equal(await repo.getByIdForAnonymousOwner(data.id, "anon-a"), null);
});

test("authenticated ownerId comes from the trusted argument, not the request payload", async () => {
  const repo = new InMemoryWorksheetRepository();
  // A malicious/forged payload that tries to smuggle an ownerId field.
  const forgedBody = makeBody({ ownerId: OWNER_B, userId: OWNER_B });
  const { data } = await postViaHandler(repo, "anon-a", OWNER_A, forgedBody);
  const foundByTrustedOwner = await repo.getByIdForOwner(data.id, OWNER_A);
  assert.equal(foundByTrustedOwner.id, data.id);
  const foundByForgedOwner = await repo.getByIdForOwner(data.id, OWNER_B);
  assert.equal(foundByForgedOwner, null);
});

test("anonymous list/detail still work for genuinely anonymous worksheets", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() });
  const list = await listWorksheetsScoped(repo, "anon-a", null);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
  const found = await getWorksheetScoped(repo, saved.id, "anon-a", null);
  assert.equal(found.id, saved.id);
});

test("authenticated list returns only that owner's worksheets", async () => {
  const repo = new InMemoryWorksheetRepository();
  const ownedByA = await repo.saveForOwner({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() }, OWNER_A);
  await repo.saveForOwner({ ...makeBody(), anonymousId: "anon-b", generatedAt: new Date() }, OWNER_B);
  await repo.save({ ...makeBody(), anonymousId: "anon-c", generatedAt: new Date() });
  const list = await listWorksheetsScoped(repo, "anon-a", OWNER_A);
  assert.deepEqual(list.map((w) => w.id), [ownedByA.id]);
});

test("authenticated detail returns owner's worksheet", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.saveForOwner({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() }, OWNER_A);
  const found = await getWorksheetScoped(repo, saved.id, "anon-a", OWNER_A);
  assert.equal(found.id, saved.id);
});

test("authenticated user cannot read another owner's worksheet", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.saveForOwner({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() }, OWNER_A);
  const found = await getWorksheetScoped(repo, saved.id, "anon-a", OWNER_B);
  assert.equal(found, null);
  const list = await listWorksheetsScoped(repo, "anon-a", OWNER_B);
  assert.deepEqual(list, []);
});

test("authenticated user does not fall back to anonymous scope, even sharing the same anonymousId", async () => {
  const repo = new InMemoryWorksheetRepository();
  // Same anonymousId as an existing anonymous (unclaimed) worksheet, but
  // the request is authenticated as OWNER_A, who does not own it.
  const anonymousOnly = await repo.save({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() });

  // A spy repository that fails the test if an anonymous-scoped method is
  // ever invoked while ownerId is set - proves no fallback by construction,
  // not merely by the current data happening to not match.
  let anonymousMethodCalled = false;
  // {...repo} would not carry the class's prototype methods, so every
  // method the scoped-access functions might call is bound explicitly.
  const spy = {
    save: repo.save.bind(repo),
    saveForOwner: repo.saveForOwner.bind(repo),
    listByOwnerId: repo.listByOwnerId.bind(repo),
    getByIdForOwner: repo.getByIdForOwner.bind(repo),
    claimAnonymousWorksheets: repo.claimAnonymousWorksheets.bind(repo),
    listByAnonymousId: (...args) => {
      anonymousMethodCalled = true;
      return repo.listByAnonymousId(...args);
    },
    getByIdForAnonymousOwner: (...args) => {
      anonymousMethodCalled = true;
      return repo.getByIdForAnonymousOwner(...args);
    },
  };

  const found = await getWorksheetScoped(spy, anonymousOnly.id, "anon-a", OWNER_A);
  assert.equal(found, null);
  const list = await listWorksheetsScoped(spy, "anon-a", OWNER_A);
  assert.deepEqual(list, []);
  assert.equal(anonymousMethodCalled, false);
});

test("claimed/account-owned worksheet is inaccessible anonymously after sign-out (ownerId reverts to null)", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() });
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);

  // "Sign-out" is simply the next request having no authenticated session,
  // i.e. ownerId resolves to null - same anonymous cookie as before.
  const foundAnonymously = await getWorksheetScoped(repo, saved.id, "anon-a", null);
  assert.equal(foundAnonymously, null);
  const listAnonymously = await listWorksheetsScoped(repo, "anon-a", null);
  assert.deepEqual(listAnonymously, []);

  // But it remains reachable by its true owner.
  const foundByOwner = await getWorksheetScoped(repo, saved.id, "anon-a", OWNER_A);
  assert.equal(foundByOwner.id, saved.id);
});

test("inaccessible detail resolves to null (route maps this to 404, never revealing existence)", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.saveForOwner({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() }, OWNER_A);
  assert.equal(await getWorksheetScoped(repo, saved.id, "anon-a", OWNER_B), null);
  assert.equal(await getWorksheetScoped(repo, "00000000-0000-4000-8000-000000000000", "anon-a", OWNER_A), null);
});

test("existing API validation behavior remains intact regardless of ownerId", () => {
  assert.equal(validateSaveRequest(makeBody()), null);
  assert.match(validateSaveRequest(makeBody({ difficulty: "impossible" })), /difficulty/);
  assert.match(validateSaveRequest("not-an-object"), /JSON object/);
});
