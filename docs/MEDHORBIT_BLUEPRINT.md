# MedhOrbit --- Product & Architecture Blueprint

**Status:** Approved development direction\
**Version:** 1.4 (post-Phase 9D-6; Phase 9D complete)\
**Purpose:** Persistent architectural reference for humans and AI coding
assistants\
**Tagline:** Learn Smarter. Grow Brighter.

Latest implementation checkpoint: Phase 9D-6 --- final authentication,
ownership, persistence and security end-to-end verification, passed
against real local PostgreSQL and real Google OAuth with 0 defects
found. **Phase 9D (Authentication & Accounts) is now COMPLETE.** Next
roadmap phase: **Phase 10 --- Practice & Assessment** (not started; no
requirements defined yet) --- see sections 5, 16, 20, and 25.

## 1. Purpose

This document is the source of truth for MedhOrbit's product direction
and staged architecture. Before implementing a feature, determine which
roadmap phase it belongs to, whether it is required now, and whether an
existing boundary should be reused. Do not implement later-phase
features merely because they are technically interesting.

## 2. Product vision

MedhOrbit helps students learn, practice, assess, and improve through
curriculum-aligned, AI-assisted personalized learning.

``` text
Generate → Practice → Assess → Identify Weakness
         → Personalized Practice → Explain/Tutor → Track Progress
```

The worksheet generator is the entry product, not the entire long-term
product.

## 3. Target users and positioning

Long term: parents, students, teachers, and schools.

MVP focus: a parent or teacher who wants to quickly create a useful CBSE
practice worksheet for a child.

Initial positioning:

> **CBSE-first AI worksheet and personalized-practice platform with a
> strong quality-validation layer.**

The differentiator should evolve from merely generating worksheets to
generating curriculum-aligned educational material and verifying the
output before presenting it.

## 4. MVP product flow

``` text
Landing Page
    ↓
Worksheet Generator
    ├── Class
    ├── Subject
    ├── Topic
    ├── Difficulty
    └── Question Count
    ↓
Generate
    ↓
Worksheet
    ↓
Quality Validation        [when real AI is introduced]
    ↓
Worksheet Preview
    ├── Questions
    ├── Answer Key
    └── Explanations      [later iteration]
    ↓
Print / PDF
```

## 5. Current implementation checkpoint

Phases 0--9D are complete. **Phase 9D (Authentication & Accounts) is
fully complete**, ending with Phase 9D-6's final end-to-end verification
(no commit produced; verification-only, like Phase 9C-4 below). Next
roadmap phase is Phase 10 --- Practice & Assessment (not started).

Completed:

- Phase 0 --- Foundation (Next.js/React/TypeScript/Tailwind, landing
  page, design tokens)
- Phase 1 --- Domain + mock generator (`generateWorksheet(config)`)
- Phase 2 --- Configuration UI
- Phase 3 --- Generate + preview
- Phase 4 --- Answer key
- Phase 5 --- Print / Save as PDF
- Phase 6A --- Class 5 Mathematics curriculum/catalog
- Phase 6B --- API/schema boundary
- Phase 6C --- Anthropic provider integration
- Phase 6D --- Class 3 mock + Class 5 AI dual path
- Phase 7A --- AI quality validation (batched evaluation)
- Phase 7B --- One controlled regeneration on quality failure
- Phase 7C --- Logical consistency, grade/difficulty and
  semantic-redundancy hardening
- Phase 7 regression harness --- 7 zero-cost tests against real
  production logic
- Phase 8A --- Curriculum audit
- Phase 8B --- Topic-specific prompt context
- Phase 8C --- Controlled real verification
- Phase 9B --- Persistence backend (Docker PostgreSQL, migration +
  connection pool, `WorksheetRepository`, anonymous ownership cookie,
  save/list/get APIs) --- **complete**
- Phase 9C --- Persistence UI (Save Worksheet, My Worksheets, reopen +
  shared print flow, full end-to-end verification) --- **complete**
- Phase 9D-1A --- Better Auth foundation/config (`better-auth@1.7.5`,
  existing `pg.Pool` reused, database-backed sessions, UUID ids, IP
  tracking disabled, OAuth token encryption enabled, Next.js auth route
  created; Google provider **not** wired) --- **complete**
- Phase 9D-1B --- Better Auth PostgreSQL schema (`user`/`session`/
  `account`/`verification` tables generated, reviewed, migrated, and
  verified locally) --- **complete**
- Phase 9D-1C --- Google OAuth configuration and real OAuth verification
  (`socialProviders.google` wired with real Cloud project credentials;
  a real Google sign-in was performed end-to-end) --- **complete**
- Phase 9D-2A --- worksheet ownership foundation (`worksheets.owner_id`
  UUID column added, nullable, FK → `user(id)`; anonymous rows keep
  `owner_id NULL`, unchanged from Phase 9B/9C) --- **complete**
- Phase 9D-3A --- atomic/idempotent anonymous worksheet claim primitive
  (a single repository operation reassigns all of one anonymous
  session's unclaimed worksheets to an owner; cannot reassign a
  worksheet that already has an owner; safe to run more than once)
  --- **complete**
- Phase 9D-3B --- claim-on-auth (Better Auth's
  `databaseHooks.session.create.after` invokes the Phase 9D-3A claim
  primitive right after a session is created, using only the
  browser's existing anonymous cookie and the new session's trusted
  user id; claim failures are swallowed and never fail sign-in)
  --- **complete**
- Phase 9D-4A --- authenticated worksheet saving (`saveForOwner`
  inserts directly with a server-derived `owner_id`; no claim step
  needed for a save made while already signed in) --- **complete**
- Phase 9D-4B --- auth-aware worksheet APIs (save/list/get routes
  resolve identity via a trusted server-side session lookup only;
  an authenticated request is scoped to `owner_id` and never falls
  back to the anonymous cookie; a wrong/inaccessible id returns a
  generic 404) --- **complete**
- Phase 9D-5A --- Google authentication UI (navbar "Sign in" when
  signed out; Google-only `signIn.social`; compact first-name label,
  "My Worksheets," and "Sign out" when signed in; sign-out redirects
  to `/` to discard stale authenticated client state) --- **complete**
- Phase 9D-6 --- final authentication/security end-to-end verification
  against real local PostgreSQL and real Google OAuth --- **complete,
  0 defects found** (full evidence in the Phase 9D-6 subsection below)

Phase 8C evidence (`class-5 / mathematics / data-interpretation / easy /
5`):

- HTTP 200, 5 questions returned
- All answers manually verified correct
- All questions self-contained; no external image/chart required
- No obvious semantic duplicates
- No Phase 7B retry triggered
- Approximately 2 Anthropic calls

Caveat: this test did NOT directly verify the separate `pictographs`
topic. One data-interpretation question happened to use pictograph-style
data.

### Phase 9B --- persistence backend (architecture)

Local development:

``` text
Next.js → PostgreSQL in Docker → localhost:5433
```

Production direction (not yet built): a managed PostgreSQL instance
replaces the local Docker container; the application-level persistence
architecture below does not change.

Persistence architecture:

``` text
API routes
   ↓
Anonymous httpOnly ownership cookie
   ↓
WorksheetRepository
   ↓
PostgreSQL
```

The `worksheets` table currently stores, per saved worksheet:

- UUID `id`
- anonymous ownership id (httpOnly cookie value, server-generated;
  never a user account)
- `classId`
- `subjectId`
- `topicId`
- `difficulty`
- question count
- `questions` --- a frozen JSONB snapshot of the exact generated
  questions/answers
- `generatedAt`
- `savedAt`

No authentication exists yet. Ownership is an opaque anonymous cookie
only --- see section 16.

### Phase 9C --- persistence UI (capabilities)

Users can now:

``` text
Generate Worksheet
   ↓
Save Worksheet
   ↓
My Worksheets
   ↓
Reopen exact saved worksheet
   ↓
View Answer Key
   ↓
Print / Save as PDF
```

Important behavior:

- Reopening a saved worksheet does not regenerate it and costs 0
  Anthropic calls --- the stored JSONB snapshot is rendered as-is, with
  no re-validation.
- Saved worksheets are immutable snapshots; there is no edit or
  regenerate-in-place.
- The My Worksheets list shows metadata only (class, subject, topic,
  difficulty, question count, saved time) --- never questions or
  answers.
- Exact questions/answers are returned only by the single-worksheet
  detail endpoint/page.
- Anonymous ownership is enforced server-side (repository query), not
  merely in the UI.
- A wrong or missing ownership cookie returns a safe 404 ("Worksheet
  not found") --- it never distinguishes "does not exist" from
  "belongs to someone else."

### Phase 9C-4 verification evidence

Full end-to-end regression of the Phase 9C persistence flow, executed
against local Docker PostgreSQL with Class 3 deterministic generation
only:

- 51/51 worksheet tests pass (`npm run test:worksheets`)
- TypeScript clean (`npx tsc --noEmit`)
- Lint clean
- `git diff --check` clean
- Class 3 deterministic end-to-end passed: Generate → Save → My
  Worksheets → Reopen → Answer Key → Print readiness
- Ownership isolation passed (correct cookie, no cookie, different
  cookie, different-cookie list --- all behaved safely)
- PostgreSQL JSONB/timestamp integrity passed (stored snapshot matches
  the API response exactly; `generatedAt` and `savedAt` are distinct)
- Print DOM/CSS readiness verified (shared print container/classes,
  answer key included, no duplicate print implementation)
- 0 Anthropic calls
- Database returned to its pre-test baseline row count
- No code changes were required; no commit for Phase 9C-4

Cost/testing strategy:

- Normal AI generation: 1 generation + 1 batched evaluation ≈ 2
  Anthropic calls
- Worst case with one quality retry: maximum ≈ 4 calls
- Normal regression: `npm run test:worksheets` --- 51 tests, 0
  Anthropic calls (worksheet generation/quality regression plus
  worksheet persistence, save/list/get API, and saved-worksheet
  reopen coverage)
- Saving, listing, and reopening a worksheet never call the Anthropic
  provider

### Phase 9D --- authentication & accounts (architecture, complete)

``` text
Better Auth (Google-only)
   ↓
Existing PostgreSQL / pg.Pool (same database as worksheets)
   ↓
Database-backed sessions
   ↓
Session-derived ownerId (server-trusted only)
   ↓
worksheets.owner_id (NULL = anonymous, set = account-owned)
```

Configured decisions (Phase 9D-1A, `frontend/src/lib/auth/auth.ts`):

- `better-auth@1.7.5`, reusing the existing pooled `pg.Pool` --- no
  separate auth database
- Database-backed sessions (Better Auth's default with no secondary
  storage configured)
- UUID user/session/account ids (`advanced.database.generateId:
  "uuid"`), matching every other id already in this schema
- IP address tracking disabled (`advanced.ipAddress.disableIpTracking:
  true`) --- data minimization
- OAuth token encryption enabled (`account.encryptOAuthTokens: true`)
  --- tokens are encrypted at rest, not stored in plaintext
- Next.js catch-all auth route created
  (`app/api/auth/[...all]/route.ts`)
- `socialProviders.google` intentionally **not** configured yet at
  this 9D-1A checkpoint --- deferred to Phase 9D-1C; the core schema
  does not depend on which providers are configured, so this was a
  safe, zero-cost thing to defer. (Google was subsequently configured
  in Phase 9D-1C, below --- this bullet describes the 9D-1A state
  only.)

Schema applied locally (Phase 9D-1B, `frontend/migrations/
002_add_better_auth_tables.sql`, generated by Better Auth's own CLI,
reviewed, then applied through MedhOrbit's existing `npm run
db:migrate` --- not Better Auth's own migrate command):

- `user` --- UUID primary key, `email` UNIQUE, plus `name`/`image`/
  `emailVerified`/timestamps (Google supplies `name`/`image`; MedhOrbit
  does not render them anywhere yet)
- `session` --- UUID primary key, `token` UNIQUE, `userId` UUID FK →
  `user(id)` ON DELETE CASCADE, indexed (`session_userId_idx`);
  `ipAddress`/`userAgent` columns exist but `ipAddress` is never
  populated (tracking disabled above)
- `account` --- UUID primary key, `userId` UUID FK → `user(id)` ON
  DELETE CASCADE, indexed (`account_userId_idx`), OAuth token columns
  (`accessToken`/`refreshToken`/`idToken`/scope/expiry); Better Auth's
  own currently-shipped 1.7.5 generated schema has **no** database-level
  `UNIQUE(providerId, accountId)` constraint (a known, open upstream
  gap, not a MedhOrbit omission) --- preserved as generated rather than
  hand-diverging from it
- `verification` --- UUID primary key, `identifier` indexed
  (`verification_identifier_idx`, not unique); used for OAuth
  state/PKCE during sign-in and for any future email-verification/
  password-reset flow (dormant --- Google-only, no email/password
  provider enabled)

Verified locally against Docker PostgreSQL (Phase 9D-1B): migration
applies cleanly, a second `db:migrate` run reports "No pending
migrations" (idempotent), all ids are UUID, both foreign keys cascade on
delete, and the worksheets row count was unaffected.

Google OAuth (Phase 9D-1C) added `socialProviders.google` to the same
config, backed by a real Google Cloud project/OAuth client; a real
sign-in was completed against it, not just configured.

Ownership and claiming (Phase 9D-2A/9D-3A/9D-3B):

- `worksheets.owner_id` --- nullable UUID FK → `user(id)`. `NULL` means
  anonymous (unchanged Phase 9B/9C cookie-scoped behavior); a set value
  means account-owned.
- The claim primitive reassigns every unclaimed (`owner_id IS NULL`)
  worksheet matching the browser's existing anonymous cookie to a
  given owner, in one atomic operation. It never touches a worksheet
  that already has an `owner_id` --- claiming cannot steal or
  reassign ownership, and repeating it is a no-op.
- The claim runs automatically from Better Auth's own
  `databaseHooks.session.create.after`, immediately after a session is
  created (i.e., right after sign-in), using only the trusted new
  session's user id and the browser's own existing anonymous cookie
  --- never a client-supplied id. A claim failure is swallowed and
  never fails authentication.

Auth-aware worksheet APIs (Phase 9D-4A/9D-4B):

- `ownerId` for every save/list/get request comes only from a verified
  Better Auth session lookup on the server --- never from the request
  body, query string, or a cookie value the client could set.
- A signed-in request is scoped to `owner_id` only and structurally
  cannot fall back to the anonymous-cookie path (the scoping function
  branches once on `ownerId` and never runs both queries).
- Saving while already signed in inserts directly with `owner_id` set
  --- it does not go through the claim primitive at all.
- A worksheet that doesn't exist, belongs to a different owner, or was
  already claimed away from the requesting anonymous cookie all return
  the same generic 404 ("Worksheet not found"), never a distinguishing
  403.
- API responses (list and detail) never include `ownerId`,
  `anonymousId`, a user id, or any session/token value --- only
  worksheet content and metadata.

Sign-in/sign-out UI (Phase 9D-5A, `frontend/src/components/layout/
AuthStatus.tsx`):

- Signed out: navbar shows "Sign in," which calls Better Auth's
  `signIn.social({ provider: "google" })` --- Google only, no
  email/password or magic-link UI was added.
- Signed in: navbar shows a compact first-name label (derived only
  from the session's `name` field, never email/id/token), "My
  Worksheets," and "Sign out."
- Sign-out calls Better Auth's own `signOut()` and, on success,
  navigates to `/` (`window.location.assign("/")`) --- a full browser
  navigation, so any stale authenticated client-side worksheet state
  is discarded along with it, not just the session.
- The UI is presentation-only: it reflects whatever the session cookie
  already proves and cannot grant or influence API authorization.

Phase 9D-6 final end-to-end verification (real local PostgreSQL, real
Google OAuth, Class 3 deterministic worksheets, 0 Anthropic calls):

- Anonymous save → real Google sign-in → claim: verified exactly once,
  `owner_id` NULL → owner, `anonymous_id` preserved, no duplicate row
- Authenticated direct save: inserted already account-owned, no claim
  step invoked
- Owner isolation: authenticated access scoped correctly; no
  authenticated fallback to anonymous scope
- Forged identity fields: a POST body with forged `ownerId`/`userId`
  had no effect --- ownership was still sourced only from the server
  session
- Generic 404: confirmed for a nonexistent id with no session
- Sign-out isolation: ownership unchanged in the database after
  sign-out; account-owned worksheets were unreachable through the
  anonymous list/detail endpoints; nothing reverted to anonymous
- Re-login: all three worksheets (original baseline, claimed anonymous
  worksheet, authenticated direct-save worksheet) reappeared with
  unchanged ownership and timestamps --- no duplicate/second claim
  occurred
- Cleanup returned the database exactly to its pre-test baseline row
  count; Better Auth user/account data was left untouched
- `npm run test:worksheets` 119/119, TypeScript clean, lint clean,
  `git diff --check` clean, 0 Anthropic calls, **no implementation
  defects found**

Explicitly still not part of Phase 9D: no child/student profile, date
of birth, school, phone number, address, or email/password/magic-link
authentication of any kind was added.

Always inspect current Git history/status rather than assuming this
checkpoint is still latest.

## 6. Core architectural boundary

The UI must not directly know how questions are produced.

``` text
UI
 ↓
generateWorksheet(config)
 ↓
Worksheet
```

Initially:

``` text
UI → generateWorksheet() → local mock questions
```

Later:

``` text
UI → worksheet API/service → AI generation → validation → Worksheet
```

Keep this contract stable where practical. Avoid provider/repository
abstractions until real requirements justify them.

## 7. Frontend structure

``` text
frontend/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── worksheets/
│       └── page.tsx
├── components/
│   ├── common/
│   │   ├── Container.tsx
│   │   └── Section.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   ├── landing/
│   └── worksheets/
│       ├── WorksheetGenerator.tsx
│       └── WorksheetPreview.tsx   # when implemented
├── lib/
│   └── worksheets/
│       ├── types.ts
│       ├── mock-data.ts
│       └── generateWorksheet.ts
└── constants/
    ├── colors.ts
    ├── spacing.ts
    ├── typography.ts
    └── navigation.ts
```

Add new layers only when a concrete requirement justifies them. Do not
create empty architectural layers for hypothetical future needs.

## 8. Worksheet domain

Input:

``` text
WorksheetConfig
├── class
├── subject
├── topic
├── difficulty
└── questionCount
```

Output evolves toward:

``` text
Worksheet
├── metadata/config snapshot
├── questions[]
│   ├── id
│   ├── prompt
│   ├── type
│   └── difficulty
└── answerKey[]
```

Possible future question types include MCQ, fill-in-the-blank, short
answer, long answer, true/false, word problem, and matching. Do not
implement all types at once.

## 9. Curriculum model

Long-term hierarchy:

``` text
Curriculum
└── Board
    └── CBSE
        └── Class
            └── Subject
                └── Chapter
                    └── Topic
```

The catalog currently has two paths:

- **Class 3 Mathematics** --- the deterministic mock/regression path.
  It is intentionally tiny (Addition / Multiplication, Easy / Medium /
  Hard, small supported question counts) and continues to use its
  existing local mock question bank. It is a technical proof, not the
  production curriculum.
- **Class 5 Mathematics** --- the AI-generation pilot curriculum, based
  on *Maths Mela --- Textbook of Mathematics for Grade 5*. The catalog
  currently contains 15 chapters and 49 topics, with Easy / Medium /
  Hard difficulty and supported AI worksheet counts of 5, 10, and 15.
  Class 5 questions are AI-generated (with quality validation), not
  mock questions.

No other classes or subjects are in the catalog.

## 10. Worksheet Generator UI rules

Use one ordered form rather than separate wizard pages:

``` text
Class → Subject → Topic → Difficulty → Question Count → Generate
```

Rules: - Subjects depend on Class. - Topics depend on Subject. -
Changing Class resets dependent selections. - Changing Subject resets
Topic. - Only supported question counts are offered. - Invalid
curriculum combinations must not be representable. - Keep form state
local until broader state management is genuinely required. - Preview
initially remains on `/worksheets`.

## 11. Future AI architecture

Do not build:

``` text
User → LLM → Worksheet
```

Target:

``` text
Worksheet Request
    ↓
Validate Request
    ↓
Structured Prompt
    ↓
LLM
    ↓
Structured Output
    ↓
Schema Validation
    ↓
Educational Quality Checks
    ↓
Safety / Content Checks
    ↓
Worksheet
```

Prefer structured output that can be programmatically validated.

## 12. Quality Engine

The quality layer is a strategic differentiator.

Candidate checks: - Schema validity - Subject/topic match - Class-level
appropriateness - Difficulty appropriateness - Duplicate detection -
Answer presence - Answer consistency/correctness - Safety/content
checks - Formatting validity

``` text
PASS → Worksheet
FAIL → Retry / regenerate / reject
```

Potential AI evaluation dimensions include relevance, correctness,
duplication, difficulty, curriculum alignment, answer consistency,
format adherence, groundedness when retrieval exists, and safety.

Do not implement all checks before real AI generation exists.

## 13. Backend and database strategy

Do not add a separate backend just because the long-term system may need
one.

Early:

``` text
Next.js → Local generator
```

AI stage:

``` text
Next.js → Server/API boundary → AI provider
```

Persistence stage (**implemented, Phase 9B/9C** --- worksheet save/list/
reopen only; see section 5 for the full architecture and table shape):

``` text
Frontend
   ↓
Application API routes
   ├── AI provider
   └── WorksheetRepository → PostgreSQL
```

Local development runs PostgreSQL 16 in Docker on `localhost:5433`;
production is expected to point the same repository/pool boundary at a
managed PostgreSQL instance later, with no change to the API/repository
contract.

Persistence beyond a saved worksheet snapshot --- user accounts, student
profiles, attempts, answers, progress, or weak-topic analysis --- is
still future work; introduce each piece only when it is genuinely
required.

Conceptual future data flow:

``` text
User → Worksheet → Attempt → Answer → Assessment → Topic Performance
```

Choose concrete backend technology when backend requirements are real.
Avoid premature microservices.

## 14. Personalization

Future loop:

``` text
Student
  ↓
Learning History
  ↓
Weakness Detection
  ↓
Personalized Worksheet
  ↓
Assessment
  ↓
Updated Learning Profile
```

This is not an MVP requirement.

## 15. RAG / curriculum grounding

Do not add a vector database or RAG simply because the product uses AI.
Introduce retrieval when reliable grounding against specific approved
curriculum/chapter content is necessary.

``` text
Approved Curriculum Content
       ↓
Retrieval
       ↓
Relevant Context
       ↓
LLM
       ↓
Grounded Questions
```

Content ingestion must respect applicable licensing requirements.

## 16. Authentication

**Complete (Phase 9D).** MedhOrbit now has real, working, Google-only
authentication: **Better Auth**, reusing the existing PostgreSQL /
`pg.Pool`, database-backed sessions, UUID user/session/account ids,
OAuth token encryption enabled, IP tracking disabled. See the Phase 9D
architecture subsection in section 5 for full configuration, schema,
ownership, claim, API, UI, and verification detail.

Final behavior:

- **Google-only** sign-in --- no email/password or magic-link
  authentication exists or is planned for this phase.
- Anonymous worksheets keep `owner_id NULL`, exactly as in Phase 9B/9C;
  authenticated worksheets get a server-derived `owner_id` that the
  client can never set or override.
- Anonymous worksheets are claimed onto an account atomically and
  idempotently, immediately on successful sign-in; claiming can never
  reassign a worksheet that already has an owner.
- Authenticated requests are scoped to `owner_id` only and never fall
  back to anonymous-cookie access; an inaccessible worksheet returns a
  generic 404, never a distinguishing 403.
- Sign-out does not alter worksheet ownership in the database, and
  redirects to `/`, discarding stale authenticated client state; a
  later re-login with the same account restores access to the same
  worksheets with no duplicate claim.
- The navbar supports Sign in, a compact first-name display when
  signed in, "My Worksheets," and "Sign out" --- nothing else.

Explicitly **not built, and not planned for this phase**:

- Child/student profiles, date of birth, school, phone number, or
  address
- Email/password or magic-link authentication
- Any provider other than Google
- Roles/permissions, teacher or school accounts (future phases only,
  per section 20)

Phase 9D-6 (section 5) is this feature's final verification: it was run
against real local PostgreSQL and real Google OAuth and found 0
implementation defects. After cleanup, the worksheet count returned
exactly to its pre-test baseline and Better Auth user/account data was
left unchanged; the session count did not return to its original
pre-test count, since normal Better Auth session lifecycle (created on
each real sign-in) was deliberately preserved rather than manually
manipulated.

## 17. Print / PDF

This is an early-value feature:

``` text
Generate → Preview → Edit/Regenerate → Answer Key → Print/PDF
```

## 18. Testing strategy

Traditional: - Unit - Integration - API - UI/E2E - Accessibility -
Performance - Security

AI-specific: - Prompt/input contracts - Structured-output/schema
validation - Relevance - Answer correctness - Curriculum alignment -
Difficulty - Duplicate detection - Groundedness when retrieval exists -
Safety - Regression evaluation datasets

Add testing technology when appropriate; do not add frameworks solely to
satisfy this document.

## 19. CI/CD direction

``` text
GitHub
  ↓
CI/CD
  ├── Lint
  ├── TypeScript
  ├── Unit/Integration Tests
  ├── AI Evaluations       [when AI exists]
  └── Production Build
       ↓
     Deploy
```

Local development already uses Docker for PostgreSQL (section 13); CI/CD
pipeline infrastructure and more complex deployment tooling are still
introduced only when justified.

## 20. Development roadmap

  Phase   Scope                                  Blueprint status
  ------- -------------------------------------- ------------------
  0       Project/design foundation              Complete
  1       Worksheet domain + mock generator      Complete
  2       Worksheet configuration UI             Complete
  3       Generate + worksheet preview           Complete
  4       Answer key                             Complete
  5       Print/PDF                              Complete
  6       Real AI generation (6A--6D)            Complete
  7       AI quality-validation layer (7A--7C)   Complete
  8       Class 5 curriculum (8A--8C)            Complete
  9A      Persistence/accounts architecture      Complete
  9B      Persistence backend (9B-1--9B-4)       Complete
  9C      Persistence UI (9C-1--9C-4)            Complete
  9D-1A   Better Auth foundation/config           Complete
  9D-1B   Better Auth PostgreSQL schema           Complete
  9D-1C   Google OAuth configuration              Complete
  9D-2    Worksheet authenticated ownership       Complete
  9D-3    Anonymous → account claiming            Complete
  9D-4    Auth-aware worksheet APIs               Complete
  9D-5    Sign-in/sign-out UI                     Complete
  9D-6    E2E/security verification               Complete
  9D      Authentication & Accounts (overall)     **Complete**
  10      Practice + assessment                  Next
  11      Progress + weak-topic detection        Planned
  12      Personalized worksheets                Planned
  13      AI explanations/tutor                  Planned
  14      Teacher tools                          Future
  15      School platform                        Future

If an idea belongs to a later phase, record it rather than implementing
it immediately.

## 21. Portfolio MVP completion criteria

The first serious portfolio MVP should demonstrate:

``` text
Class 5
  ↓
Subject
  ↓
Topic
  ↓
Difficulty
  ↓
Question Count
  ↓
AI Generation
  ↓
Quality Checks
  ↓
Preview
  ↓
Answer Key
  ↓
PDF / Print
```

This is enough to demonstrate product engineering, AI integration,
structured outputs, AI evaluation/quality engineering, testing, and
deployment without building the whole platform.

## 22. Explicit current non-goals

Do not build now unless the roadmap is deliberately revised: - Classes
1--12 all at once - School administration - Large teacher dashboards -
Payment integration - Native mobile app - Gamification - Redis -
Microservices - Vector DB - RAG before grounding is required - AI
agents - Complex roles/permissions - Kubernetes - Large analytics
platform

## 23. Engineering working agreement

Preferred workflow:

``` text
Architecture / requirement
        ↓
Small implementation scope
        ↓
Codex implementation
        ↓
Lint + TypeScript + Build + diff checks
        ↓
Independent review
        ↓
Explicit commit-gate approval
        ↓
Commit
        ↓
Push
        ↓
Next phase
```

Rules: - Never stage/commit/push before explicit commit-gate approval. -
Green tests alone do not authorize commit. - Avoid unrelated changes in
scoped tasks. - Prefer small meaningful commits. - Inspect the real
repository before assuming state. - Avoid broad destructive Git cleanup
commands. - New architecture must solve a current or clearly imminent
requirement.

## 24. Decision rule for future features

Before implementing a new idea, ask: 1. Does it support the current
product goal? 2. Which roadmap phase does it belong to? 3. Is it
required for the current phase? 4. Can the existing architecture support
it? 5. Are we adding complexity before it is needed? 6. How will we
validate it? 7. Does it strengthen MedhOrbit as a product rather than
merely making the architecture look sophisticated?

## 25. Immediate continuation point

Phases 0--9D are complete, including Phase 9D-6's final end-to-end
verification. **NEXT:**

``` text
Phase 10 — Practice & Assessment
```

State clearly, before starting it:

- No Phase 10 requirements have been defined yet in this document ---
  do not invent or assume scope. Section 20 names it only as "Practice
  + assessment"; section 21's conceptual flow (`Attempt → Answer →
  Assessment → Topic Performance`, section 13) is direction, not an
  approved spec.
- Authentication (Phase 9D) is done and stable: reuse its `owner_id`/
  session boundary for any per-user practice or assessment data rather
  than inventing a parallel identity model.
- Secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, and `DATABASE_URL`) must remain only in
  `.env.local` (local dev) or the deployment environment's own secret
  store (production) --- never in this document, never in committed
  code, never in chat/prompt text.
- **Never paste real secrets into ChatGPT, Claude, or any other AI
  assistant session.** Placeholders/variable names only.
- Never commit credentials, `.env.local`, or any file containing a real
  secret value.

Progress tracking, personalized practice, AI tutoring, multi-subject
expansion, RAG and school features remain future work per the roadmap
in section 20. Confirm each new phase's scope explicitly before
starting it, rather than assuming this document already specifies it.

## 26. Prompt for future ChatGPT/Codex sessions

``` text
Read docs/MEDHORBIT_BLUEPRINT.md before proposing or implementing changes.

Treat it as the approved MedhOrbit product and architecture direction.

Inspect the current repository and Git status because implementation may have progressed beyond the checkpoint recorded in the blueprint.

Identify the current roadmap phase from the actual code/history and this blueprint.

Do not implement later-phase features unless explicitly approved.
Keep changes small and reviewable.
Do not stage, commit, push, or delete files unless explicitly instructed.
```

## 27. Architecture summary

``` text
                         MEDHORBIT
                  Learn Smarter. Grow Brighter.
                              │
                              ▼
                       CBSE Curriculum
                              │
                              ▼
                    Worksheet Generator
                              │
                 Class / Subject / Topic
                              │
                    Difficulty + Count
                              │
                              ▼
                         AI Generator
                              │
                              ▼
                     QUALITY ENGINE
                              │
           Schema / Curriculum / Answer Checks
                              │
                              ▼
                       Worksheet Preview
                              │
                    Answer Key + PDF/Print
                              │
                              ▼
                 Practice → Assessment
                              │
                              ▼
                    Weak Topic Detection
                              │
                              ▼
                   Personalized Practice
                              │
                              ▼
                         AI Tutor
                              │
                              ▼
             Parent / Teacher / School Experiences
```

------------------------------------------------------------------------

**Architecture principle:** Build the smallest useful product first.
Preserve clean boundaries for future growth, but do not build future
infrastructure before the product needs it.
