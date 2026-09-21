// Compiles the worksheet modules to a temp dir with the project's own TypeScript
// and runs the zero-cost regression tests. Makes no network or API calls.
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
      "--outDir", outDir,
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
      ["--test", "tests/worksheets/quality.regression.test.mjs"],
      { stdio: "inherit", env: { ...process.env, WORKSHEET_TEST_BUILD_DIR: outDir, ANTHROPIC_API_KEY: "" } },
    );
    code = run.status ?? 1;
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
process.exit(code);
