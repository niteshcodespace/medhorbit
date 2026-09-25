// Compiles the worksheet, auth, and practice modules to a temp dir with the
// project's own TypeScript and runs the zero-cost quality regression and
// persistence tests. Makes no network or API calls.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";

// Inside node_modules so compiled output resolves the project's dependencies.
const cacheDir = path.resolve("node_modules/.cache");
mkdirSync(cacheDir, { recursive: true });
const outDir = mkdtempSync(path.join(cacheDir, "worksheet-tests-"));
let code = 1;
try {
  const tsc = spawnSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "src/lib/worksheets/service.ts",
      "src/lib/worksheets/memory-repository.ts",
      "src/lib/worksheets/postgres-repository.ts",
      "src/lib/worksheets/save-validator.ts",
      "src/lib/worksheets/saved-client.ts",
      "src/lib/worksheets/scoped-access.ts",
      "src/lib/auth/worksheet-claim-hook.ts",
      "src/lib/auth/display-name.ts",
      "src/lib/practice/memory-repository.ts",
      "src/lib/practice/postgres-repository.ts",
      "src/lib/practice/dto.ts",
      "src/lib/practice/question-support.ts",
      "src/lib/practice/service.ts",
      "src/lib/practice/client.ts",
      "--outDir", outDir,
      "--rootDir", "src/lib",
      "--module", "commonjs",
      "--moduleResolution", "node",
      "--target", "es2020",
      "--esModuleInterop",
      "--skipLibCheck",
      "--strict",
    ],
    { stdio: "inherit" },
  );
  if (tsc.status === 0) {
    const run = spawnSync(
      process.execPath,
      [
        "--test",
        "tests/worksheets/quality.regression.test.mjs",
        "tests/worksheets/persistence.test.mjs",
        "tests/worksheets/api-persistence.test.mjs",
        "tests/worksheets/saved-worksheets.test.mjs",
        "tests/worksheets/saved-worksheet-detail.test.mjs",
        "tests/worksheets/ownership.test.mjs",
        "tests/worksheets/claim.test.mjs",
        "tests/worksheets/claim-on-session.test.mjs",
        "tests/worksheets/authenticated-save.test.mjs",
        "tests/worksheets/api-auth-scope.test.mjs",
        "tests/auth/auth-ui.test.mjs",
        "tests/practice/practice-repository.test.mjs",
        "tests/practice/practice-api.test.mjs",
        "tests/practice/practice-client.test.mjs",
        "tests/practice/practice-ui.test.mjs",
      ],
      { stdio: "inherit", env: { ...process.env, WORKSHEET_TEST_BUILD_DIR: outDir, ANTHROPIC_API_KEY: "" } },
    );
    code = run.status ?? 1;
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
process.exit(code);
