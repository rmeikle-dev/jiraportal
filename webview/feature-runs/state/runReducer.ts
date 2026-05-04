import type {
  FeatureRun,
  Event as RunEvent,
  Phase,
  Story,
  StoryStatus
} from '../../../src/telemetry/types';

// The reducer accepts a snapshot (full FeatureRun) plus deltas (events).
// Snapshots replace state wholesale; events fold into the existing state and
// update derived fields (phase status, story status, totals).

export type RunAction =
  | { type: 'snapshot'; run: FeatureRun }
  | { type: 'append'; events: RunEvent[] };

export interface RunState {
  run: FeatureRun | null;
}

export const initialRunState: RunState = { run: null };

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'snapshot':
      return { run: action.run };
    case 'append':
      if (!state.run) return state;
      return { run: applyEvents(state.run, action.events) };
  }
}

function applyEvents(run: FeatureRun, events: RunEvent[]): FeatureRun {
  let next = run;
  for (const evt of events) {
    next = applyOne(next, evt);
  }
  return next;
}

function applyOne(run: FeatureRun, evt: RunEvent): FeatureRun {
  // Append the event to the timeline (idempotent on eventId).
  const events = run.events.some((e) => e.eventId === evt.eventId)
    ? run.events
    : [...run.events, evt];

  let phases = run.phases;
  let stories = run.stories;
  let totals = run.totals;

  switch (evt.kind) {
    case 'phase.start':
      phases = updatePhase(phases, evt.phaseId, (p) => ({
        ...p,
        startedAt: evt.t,
        status: 'running'
      }));
      break;
    case 'phase.end':
      phases = updatePhase(phases, evt.phaseId, (p) => ({
        ...p,
        endedAt: evt.t,
        status: 'completed'
      }));
      break;
    case 'story.status':
      stories = updateStory(stories, evt.storyKey, (s) => ({
        ...s,
        status: evt.to as StoryStatus,
        timing: {
          ...s.timing,
          firstEventAt: s.timing.firstEventAt ?? evt.t,
          lastEventAt: evt.t,
          durationMs: durationFrom(s.timing.firstEventAt ?? evt.t, evt.t)
        }
      }));
      break;
    case 'tool.call':
      totals = { ...totals, toolCalls: totals.toolCalls + 1 };
      if (evt.storyKey) {
        stories = updateStory(stories, evt.storyKey, (s) => ({
          ...s,
          timing: {
            ...s.timing,
            firstEventAt: s.timing.firstEventAt ?? evt.t,
            lastEventAt: evt.t
          }
        }));
      }
      break;
    case 'agent.start':
      totals = { ...totals, agentCalls: totals.agentCalls + 1 };
      if (evt.storyKey) {
        stories = updateStory(stories, evt.storyKey, (s) => ({
          ...s,
          timing: {
            ...s.timing,
            firstEventAt: s.timing.firstEventAt ?? evt.t,
            lastEventAt: evt.t
          }
        }));
      }
      break;
    case 'agent.end':
      if (evt.tokens) {
        totals = {
          ...totals,
          inputTokens: totals.inputTokens + evt.tokens.input,
          outputTokens: totals.outputTokens + evt.tokens.output,
          cacheReadTokens: totals.cacheReadTokens + evt.tokens.cacheRead,
          cacheCreationTokens: totals.cacheCreationTokens + evt.tokens.cacheCreation
        };
      }
      break;
    default:
      break;
  }

  return { ...run, events, phases, stories, totals };
}

function updatePhase(
  phases: Phase[],
  phaseId: string,
  fn: (p: Phase) => Phase
): Phase[] {
  return phases.map((p) => (p.id === phaseId ? fn(p) : p));
}

function updateStory(
  stories: Story[],
  storyKey: string,
  fn: (s: Story) => Story
): Story[] {
  return stories.map((s) => (s.key === storyKey ? fn(s) : s));
}

function durationFrom(startIso: string, endIso: string): number {
  return Math.max(0, Date.parse(endIso) - Date.parse(startIso));
}
