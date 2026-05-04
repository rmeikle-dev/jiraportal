import type {
  AgentName,
  Event as RunEvent,
  FeatureRun,
  Story
} from '../../../src/telemetry/types';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatCost(usd: number | undefined): string {
  if (usd === undefined) return '—';
  return `$${usd.toFixed(2)}`;
}

export function shippedCount(run: FeatureRun): number {
  return run.stories.filter((s) => s.status === 'shipped').length;
}

export function elapsedMs(run: FeatureRun, now = Date.now()): number {
  const start = Date.parse(run.startedAt);
  const end = run.endedAt ? Date.parse(run.endedAt) : now;
  return Math.max(0, end - start);
}

// Visual styling tokens for agent badges/bars.
export const AGENT_COLORS: Record<AgentName, { bg: string; fg: string; label: string }> = {
  'agent-jira': { bg: '#3b82f6', fg: '#ffffff', label: 'jira' },
  'agent-figma': { bg: '#a855f7', fg: '#ffffff', label: 'figma' },
  'agent-analyzer': { bg: '#10b981', fg: '#ffffff', label: 'analyzer' },
  'agent-playwright': { bg: '#f59e0b', fg: '#000000', label: 'playwright' }
};

export const STATUS_COLORS: Record<Story['status'], string> = {
  pending: 'var(--vscode-descriptionForeground)',
  analyzing: '#3b82f6',
  planned: '#8b5cf6',
  implementing: '#0ea5e9',
  verifying: '#f59e0b',
  shipped: 'var(--vscode-testing-iconPassed)',
  failed: 'var(--vscode-errorForeground)',
  deferred: 'var(--vscode-descriptionForeground)'
};

// Group events by storyKey (or "phase" bucket if no story).
export function eventsByStory(run: FeatureRun): Map<string, RunEvent[]> {
  const map = new Map<string, RunEvent[]>();
  const phaseBucket: RunEvent[] = [];
  for (const e of run.events) {
    const sk = (e as { storyKey?: string }).storyKey;
    if (sk) {
      if (!map.has(sk)) map.set(sk, []);
      map.get(sk)!.push(e);
    } else {
      phaseBucket.push(e);
    }
  }
  map.set('__phase__', phaseBucket);
  return map;
}

export function findEventById(run: FeatureRun, id: string): RunEvent | undefined {
  return run.events.find((e) => e.eventId === id);
}

// Pair start/end events so the timeline can render duration bars.
export interface AgentSpan {
  storyKey?: string;
  agentType: AgentName;
  startEvent: RunEvent;
  endEvent?: RunEvent;
  startMs: number;
  endMs: number;
  inProgress: boolean;
}

export function agentSpans(run: FeatureRun): AgentSpan[] {
  const out: AgentSpan[] = [];
  const startsById = new Map<string, RunEvent>();
  for (const e of run.events) {
    if (e.kind === 'agent.start') startsById.set(e.eventId, e);
    if (e.kind === 'agent.end') {
      const start = startsById.get(e.refEventId);
      if (start && start.kind === 'agent.start') {
        out.push({
          storyKey: start.storyKey,
          agentType: start.agentType,
          startEvent: start,
          endEvent: e,
          startMs: Date.parse(start.t),
          endMs: Date.parse(e.t),
          inProgress: false
        });
        startsById.delete(e.refEventId);
      }
    }
  }
  // Open agents (in-progress)
  const now = Date.now();
  for (const start of startsById.values()) {
    if (start.kind !== 'agent.start') continue;
    out.push({
      storyKey: start.storyKey,
      agentType: start.agentType,
      startEvent: start,
      startMs: Date.parse(start.t),
      endMs: now,
      inProgress: true
    });
  }
  return out;
}
