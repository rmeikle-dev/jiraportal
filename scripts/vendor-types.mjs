#!/usr/bin/env node
// Vendors the canonical FeatureRun schema from the axon-clients skill repo
// into this extension's src/telemetry/types.ts.
//
// Usage:
//   node scripts/vendor-types.mjs           # copy with DO-NOT-EDIT header
//   node scripts/vendor-types.mjs --check   # exit 1 if vendored copy is stale (for CI)
//
// Env:
//   AXON_CLIENTS_PATH   override the skill-repo location (default: ../axon-clients
//                       resolved relative to this script).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const skillRepo = process.env.AXON_CLIENTS_PATH
  ? resolve(process.env.AXON_CLIENTS_PATH)
  : resolve(repoRoot, "..", "axon-clients");

const sourceFile = join(skillRepo, ".claude", "skills", "feature", "telemetry", "types.ts");
const destFile = join(repoRoot, "src", "telemetry", "types.ts");

const HEADER = `// =============================================================================
// VENDORED FILE — DO NOT EDIT.
// Source of truth: <axon-clients>/.claude/skills/feature/telemetry/types.ts
// Run \`npm run vendor:types\` to refresh. CI fails if this file is stale.
// =============================================================================

`;

function readSource() {
  if (!existsSync(sourceFile)) {
    console.error(`vendor-types: source not found at ${sourceFile}`);
    console.error(`Set AXON_CLIENTS_PATH if your skill repo lives elsewhere.`);
    process.exit(1);
  }
  return readFileSync(sourceFile, "utf8");
}

function readVendored() {
  if (!existsSync(destFile)) return null;
  return readFileSync(destFile, "utf8");
}

function compose(source) {
  return HEADER + source;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const composed = compose(readSource());
  const current = readVendored();

  if (checkOnly) {
    if (current !== composed) {
      console.error("vendor-types: vendored copy is stale. Run `npm run vendor:types`.");
      process.exit(1);
    }
    console.log("vendor-types: up to date.");
    return;
  }

  mkdirSync(dirname(destFile), { recursive: true });
  writeFileSync(destFile, composed, "utf8");
  console.log(`vendor-types: wrote ${destFile}`);
}

main();
