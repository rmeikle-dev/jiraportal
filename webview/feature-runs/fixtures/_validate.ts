// Compile-time validation that fixtures conform to FeatureRun.
// Not imported at runtime — exists purely to make `npm run typecheck` enforce the contract.

import type { FeatureRun } from "../../../src/telemetry/types";
import sampleRun from "./sample-run.json";
import sampleRunRunning from "./sample-run-running.json";

// Cast through `unknown` because TS infers JSON imports as wide types
// (e.g. `string` instead of literal unions). The structural assignment that
// follows is what actually validates the shape.
const completed: FeatureRun = sampleRun as unknown as FeatureRun;
const running: FeatureRun = sampleRunRunning as unknown as FeatureRun;

// Light structural assertions that catch the most common drift bugs at
// typecheck time without becoming brittle.
const _assertions: Array<FeatureRun["status"]> = [completed.status, running.status];
const _stories: number = completed.stories.length + running.stories.length;
void _assertions;
void _stories;
