# MedhOrbit --- Product & Architecture Blueprint

**Status:** Approved development direction\
**Version:** 1.0\
**Purpose:** Persistent architectural reference for humans and AI coding
assistants\
**Tagline:** Learn Smarter. Grow Brighter.

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

Completed: - Next.js/React/TypeScript/Tailwind foundation - Responsive
landing-page foundation - Button, Card, Container, Section - Navbar,
Footer, Hero, Features - Design tokens/constants - Worksheet domain
types - Small local curriculum catalog - Mock questions -
`generateWorksheet(config)` boundary

Phase 2A `/worksheets` configuration UI has been implemented locally and
is awaiting its final review/commit lifecycle at the time this blueprint
was written.

Approved Git checkpoints: - `c7e9303` ---
`Build MedhOrbit landing page foundation` - `1998d53` ---
`Add worksheet generator domain and mock generation`

`1998d53` was pushed to `origin/main` before Phase 2A began.

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

The current mock catalog is intentionally tiny: - Class 3 -
Mathematics - Addition / Multiplication - Easy / Medium / Hard - Small
supported question counts

It is a technical proof, not the production curriculum. After the
end-to-end workflow is proven, Class 5 is the preferred first meaningful
curriculum pilot.

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

Persistence stage:

``` text
Frontend
   ↓
Application API
   ├── AI
   └── PostgreSQL
```

Introduce persistence when users, saved worksheets, student profiles,
attempts, answers, progress, or weak-topic analysis require it.

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

Postpone authentication until user-specific persistence is useful, such
as saved worksheets, profiles, history, progress, teacher accounts, or
subscriptions.

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

Introduce Docker and more complex infrastructure only when justified.

## 20. Development roadmap

  Phase   Scope                                  Blueprint status
  ------- -------------------------------------- ------------------
  0       Project/design foundation              Complete
  1       Worksheet domain + mock generator      Complete
  2       Worksheet configuration UI             In progress
  3       Generate + worksheet preview           Planned
  4       Answer key                             Planned
  5       Print/PDF                              Planned
  6       Real AI generation                     Planned
  7       AI quality-validation layer            Planned
  8       Expand meaningful Class 5 curriculum   Planned
  9       Persistence/accounts                   Planned
  10      Practice + assessment                  Planned
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

At blueprint creation:

``` text
Phase 2A — Worksheet Configuration UI
        ↓
Commit-gate review
        ↓
Commit + Push
        ↓
Phase 3 — connect generateWorksheet()
        ↓
WorksheetPreview
        ↓
End-to-end mock workflow
```

Only after the mock workflow is usable end-to-end should development
move toward answer keys, print/PDF, and real AI.

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
