// =============================================================================
// VENDORED FILE — DO NOT EDIT.
// Source of truth: <axon-clients>/.claude/skills/feature/telemetry/types.ts
// Run `npm run vendor:types` to refresh. CI fails if this file is stale.
// =============================================================================

// Canonical FeatureRun schema — source of truth for the feature-skill telemetry pipeline.
//
// This file is vendored into the axon-feature-builder VS Code extension at
// src/telemetry/types.ts via scripts/vendor-types.mjs at build time. Do not edit
// the vendored copy; CI fails on drift.

export type SchemaVersion = 1;

export type AgentName =
  | "agent-jira"
  | "agent-figma"
  | "agent-analyzer"
  | "agent-playwright";

export type RunStatus = "running" | "completed" | "failed" | "aborted";

export type StoryStatus =
  | "pending"
  | "analyzing"
  | "planned"
  | "implementing"
  | "verifying"
  | "shipped"
  | "failed"
  | "deferred";

export type PhaseStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type PhaseId =
  | "phase-1"
  | "phase-2"
  | "phase-3"
  | "phase-4"
  | "phase-5"
  | "phase-6";

export type VerificationOutcome =
  | "matched"
  | "fixed-and-retrying"
  | "capped";

export type VerificationFinalState = "matched" | "capped" | "skipped";

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

export interface RunTotals {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd?: number;
  toolCalls: number;
  agentCalls: number;
}

export interface ConceptLabel {
  name: string;
  kind: string;
}

export interface AnalyzerFrame {
  path: string;
  depicts: string;
}

// Mirrors agent-analyzer.md's output contract verbatim.
export interface AnalyzerOutput {
  storyKey: string;
  intent: string;
  surfaces: string[];
  behaviors: string[];
  produces: ConceptLabel[];
  consumes: ConceptLabel[];
  frames: AnalyzerFrame[];
  ambiguities: string[];
  ticketDesignConflicts: string[];
  openQuestions: string[];
}

export interface StoryPlan {
  files: string[];
  notes: string[];
  verification?: {
    frame: string;
    route: string;
    walkInSteps: string;
  };
}

export interface StoryBranch {
  name: string;
  base: string;
  createPrUrl?: string;
}

export interface DependencyEdge {
  storyKey: string;
  viaLabel: string;
  kind: string;
}

export interface VerificationIteration {
  index: 1 | 2 | 3;
  startedAt: string;
  endedAt: string;
  discrepancies: string[];
  outcome: VerificationOutcome;
  fixCommitSha?: string;
}

export interface StoryArtifacts {
  ticketMd?: string;
  framesJson?: string;
  framePngs: string[];
  implementationPng?: string;
}

export interface StoryTiming {
  firstEventAt?: string;
  lastEventAt?: string;
  durationMs: number;
}

export interface Story {
  key: string;
  title: string;
  url: string;
  order: number;
  status: StoryStatus;
  branch?: StoryBranch;
  analysis?: AnalyzerOutput;
  plan?: StoryPlan;
  dependsOn: DependencyEdge[];
  verification?: {
    iterations: VerificationIteration[];
    finalState?: VerificationFinalState; // unset while iteration loop is in progress
  };
  contextDir: string;
  artifacts: StoryArtifacts;
  timing: StoryTiming;
  tokens: TokenBreakdown;
}

export interface Phase {
  id: PhaseId;
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  status: PhaseStatus;
  notes?: string;
}

export interface DependencyGraph {
  edges: { from: string; to: string; viaLabel: string; kind: string }[];
  cycles: string[][];
}

// ---------------------------------------------------------------------------
// Event union — flat append-only timeline driving the visualization
// ---------------------------------------------------------------------------

interface EventBase {
  eventId: string;
  t: string; // ISO-8601
}

export interface PhaseStartEvent extends EventBase {
  kind: "phase.start";
  phaseId: PhaseId;
}

export interface PhaseEndEvent extends EventBase {
  kind: "phase.end";
  phaseId: PhaseId;
}

export interface AgentStartEvent extends EventBase {
  kind: "agent.start";
  agentType: AgentName;
  storyKey?: string;
  phaseId: PhaseId;
  promptDigest: string;
  parentEventId?: string;
}

export interface AgentEndEvent extends EventBase {
  kind: "agent.end";
  refEventId: string;
  durationMs: number;
  ok: boolean;
  outputDigest: string;
  tokens?: TokenBreakdown;
}

export interface ToolCallEvent extends EventBase {
  kind: "tool.call";
  toolName: string;
  args: Record<string, unknown>;
  phaseId: PhaseId;
  storyKey?: string;
  agentEventId?: string;
}

export interface ToolResultEvent extends EventBase {
  kind: "tool.result";
  refEventId: string;
  durationMs: number;
  ok: boolean;
  resultDigest: string;
}

export interface StoryStatusEvent extends EventBase {
  kind: "story.status";
  storyKey: string;
  from: StoryStatus;
  to: StoryStatus;
}

export interface VerificationIterationEvent extends EventBase {
  kind: "verification.iteration";
  storyKey: string;
  index: number;
  outcome: VerificationOutcome;
}

export interface UserMessageEvent extends EventBase {
  kind: "user.message";
  phaseId: PhaseId;
  role: "user" | "assistant";
  textDigest: string;
}

export interface NoteEvent extends EventBase {
  kind: "note";
  text: string;
}

export type Event =
  | PhaseStartEvent
  | PhaseEndEvent
  | AgentStartEvent
  | AgentEndEvent
  | ToolCallEvent
  | ToolResultEvent
  | StoryStatusEvent
  | VerificationIterationEvent
  | UserMessageEvent
  | NoteEvent;

export type EventKind = Event["kind"];

// ---------------------------------------------------------------------------
// Top-level FeatureRun
// ---------------------------------------------------------------------------

export interface RunRepo {
  root: string;
  name: string;
  baseBranch: string;
}

export interface RunSession {
  id: string;
  transcriptPath: string;
  claudeVersion: string;
}

export interface RunOutcome {
  storiesShipped: number;
  prUrls: string[];
  deferred: string[];
}

export interface FeatureRun {
  schemaVersion: SchemaVersion;
  runId: string;
  featureKey: string;
  featureTitle: string;
  featureUrl: string;
  repo: RunRepo;
  session: RunSession;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  outcome?: RunOutcome;
  totals: RunTotals;
  phases: Phase[];
  stories: Story[];
  events: Event[];
  graph: DependencyGraph;
}

// ---------------------------------------------------------------------------
// Cross-repo run index (~/.claude/feature-runs/index.json)
// ---------------------------------------------------------------------------

export interface RunIndexEntry {
  runId: string;
  featureKey: string;
  featureTitle: string;
  repoRoot: string;
  repoName: string;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  dataPath: string; // absolute path to the run's directory
}

export interface RunIndex {
  schemaVersion: SchemaVersion;
  entries: RunIndexEntry[];
}
