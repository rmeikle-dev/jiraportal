import type {
  AgentName,
  Event as RunEvent,
  FeatureRun,
  Phase,
  Story
} from '../../src/telemetry/types';
import { AgentBadge } from './AgentBadge';
import { TokenBar } from './TokenBar';
import {
  AGENT_COLORS,
  STATUS_COLORS,
  formatDuration,
  formatTokens
} from './state/derive';

// Sequential view of the skill's execution: 6 phase cards stacked vertically.
// Phase 5 expands into a list of story sub-cards in the order they were handled.
// The currently active step gets a green glow.

export function SkillFlow({
  run,
  selectedStoryKey,
  selectedPhaseId,
  onSelectStory,
  onSelectPhase
}: {
  run: FeatureRun;
  selectedStoryKey: string | null;
  selectedPhaseId: string | null;
  onSelectStory: (storyKey: string | null) => void;
  onSelectPhase: (phaseId: string | null) => void;
}) {
  return (
    <div className="h-full overflow-auto skill-flow-bg">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-3">
        {run.phases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            run={run}
            selectedStoryKey={selectedStoryKey}
            selectedPhaseId={selectedPhaseId}
            onSelectStory={onSelectStory}
            onSelectPhase={onSelectPhase}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase card
// ---------------------------------------------------------------------------

function PhaseCard({
  phase,
  run,
  selectedStoryKey,
  selectedPhaseId,
  onSelectStory,
  onSelectPhase
}: {
  phase: Phase;
  run: FeatureRun;
  selectedStoryKey: string | null;
  selectedPhaseId: string | null;
  onSelectStory: (storyKey: string | null) => void;
  onSelectPhase: (phaseId: string | null) => void;
}) {
  const isLive = phase.status === 'running';
  const isSelected = selectedPhaseId === phase.id && selectedStoryKey === null;
  const phaseNumber = phase.id.replace('phase-', '');

  return (
    <section
      className={cardClasses(phase.status, isLive, isSelected)}
      style={cardGlowStyle(isLive)}
    >
      <button
        onClick={() => onSelectPhase(isSelected ? null : phase.id)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <StatusBadge status={phase.status} number={phaseNumber} />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-fg text-sm">{phase.name}</span>
          {phase.notes && (
            <span className="text-muted text-[11px] mt-0.5">{phase.notes}</span>
          )}
        </div>
        <DurationLabel phase={phase} />
      </button>

      {phase.id === 'phase-5' ? (
        <StoryList
          run={run}
          phase={phase}
          selectedStoryKey={selectedStoryKey}
          onSelectStory={onSelectStory}
        />
      ) : (
        <PhaseSubSteps phase={phase} run={run} />
      )}
    </section>
  );
}

function cardClasses(status: Phase['status'], isLive: boolean, isSelected: boolean): string {
  const base = 'rounded-lg border bg-card transition-all overflow-hidden';
  const borderColor = isLive
    ? 'border-[#22c55e]'
    : status === 'completed'
      ? 'border-border'
      : status === 'failed'
        ? 'border-error'
        : 'border-dashed border-border';
  const opacity = status === 'pending' ? 'opacity-60' : '';
  const ring = isSelected ? 'ring-1 ring-accent' : '';
  return `${base} ${borderColor} ${opacity} ${ring}`;
}

function cardGlowStyle(isLive: boolean): React.CSSProperties {
  if (!isLive) return {};
  return {
    boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.4), 0 0 24px rgba(34, 197, 94, 0.25)',
    animation: 'skill-flow-pulse 2s ease-in-out infinite'
  };
}

function DurationLabel({ phase }: { phase: Phase }) {
  if (!phase.startedAt) {
    return <span className="text-muted text-[10px] font-mono uppercase">pending</span>;
  }
  if (phase.endedAt) {
    return (
      <span className="text-muted text-[11px] font-mono">
        {formatDuration(Date.parse(phase.endedAt) - Date.parse(phase.startedAt))}
      </span>
    );
  }
  // Running — show live elapsed
  return (
    <span className="text-[#22c55e] text-[11px] font-mono">
      {formatDuration(Date.now() - Date.parse(phase.startedAt))} · live
    </span>
  );
}

// ---------------------------------------------------------------------------
// Phase sub-steps (non-phase-5)
// ---------------------------------------------------------------------------

function PhaseSubSteps({ phase, run }: { phase: Phase; run: FeatureRun }) {
  const subEvents = run.events.filter(
    (e) => 'phaseId' in e && (e as { phaseId?: string }).phaseId === phase.id
  );

  if (subEvents.length === 0) return null;

  // Group agent invocations
  const agentSummary = summarizeAgents(subEvents);
  const tools = subEvents.filter((e) => e.kind === 'tool.call');
  const userMessages = subEvents.filter((e) => e.kind === 'user.message');

  if (agentSummary.length === 0 && tools.length === 0 && userMessages.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
      {agentSummary.map((s, i) => (
        <AgentSummaryRow key={i} summary={s} run={run} />
      ))}
      {tools.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="font-mono">·</span>
          <span>
            {tools.length} tool {tools.length === 1 ? 'call' : 'calls'}
          </span>
        </div>
      )}
      {userMessages.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="font-mono">·</span>
          <span>
            {userMessages.length} user{' '}
            {userMessages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
      )}
    </div>
  );
}

function summarizeAgents(events: RunEvent[]) {
  const summary = new Map<
    AgentName,
    { count: number; totalDurationMs: number; totalTokens: number; parallel: boolean }
  >();
  const startTimes = new Set<number>();
  const startsById = new Map<string, RunEvent>();

  for (const e of events) {
    if (e.kind === 'agent.start') {
      startTimes.add(Date.parse(e.t));
      startsById.set(e.eventId, e);
    }
    if (e.kind === 'agent.end') {
      const start = startsById.get(e.refEventId);
      if (start && start.kind === 'agent.start') {
        const cur = summary.get(start.agentType) ?? {
          count: 0,
          totalDurationMs: 0,
          totalTokens: 0,
          parallel: false
        };
        cur.count += 1;
        cur.totalDurationMs += e.durationMs;
        if (e.tokens) {
          cur.totalTokens += e.tokens.input + e.tokens.output;
        }
        summary.set(start.agentType, cur);
      }
    }
  }

  // Detect parallel: any two starts within 500ms of each other for same agent type
  const startsByType = new Map<AgentName, number[]>();
  for (const e of events) {
    if (e.kind === 'agent.start') {
      const list = startsByType.get(e.agentType) ?? [];
      list.push(Date.parse(e.t));
      startsByType.set(e.agentType, list);
    }
  }
  for (const [type, times] of startsByType) {
    times.sort((a, b) => a - b);
    let parallel = false;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < 500) {
        parallel = true;
        break;
      }
    }
    const cur = summary.get(type);
    if (cur) cur.parallel = parallel;
  }

  return Array.from(summary.entries()).map(([agent, info]) => ({ agent, ...info }));
}

function AgentSummaryRow({
  summary,
  run
}: {
  summary: {
    agent: AgentName;
    count: number;
    totalDurationMs: number;
    totalTokens: number;
    parallel: boolean;
  };
  run: FeatureRun;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <AgentBadge agent={summary.agent} />
      <span className="text-fg">
        × {summary.count}
        {summary.count > 1 && summary.parallel && (
          <span className="text-muted ml-1">parallel</span>
        )}
      </span>
      <span className="text-muted ml-auto font-mono">
        {formatDuration(summary.totalDurationMs)}
        {summary.totalTokens > 0 && (
          <> · {formatTokens(summary.totalTokens)} tok</>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story list (Phase 5 only)
// ---------------------------------------------------------------------------

function StoryList({
  run,
  phase,
  selectedStoryKey,
  onSelectStory
}: {
  run: FeatureRun;
  phase: Phase;
  selectedStoryKey: string | null;
  onSelectStory: (storyKey: string | null) => void;
}) {
  if (run.stories.length === 0) return null;
  const ordered = [...run.stories].sort((a, b) => a.order - b.order);

  return (
    <div className="border-t border-border bg-bg/40 flex flex-col">
      {ordered.map((story, idx) => (
        <StoryRow
          key={story.key}
          story={story}
          run={run}
          index={idx + 1}
          total={ordered.length}
          selected={selectedStoryKey === story.key}
          onSelect={() =>
            onSelectStory(selectedStoryKey === story.key ? null : story.key)
          }
        />
      ))}
    </div>
  );
}

function StoryRow({
  story,
  run,
  index,
  total,
  selected,
  onSelect
}: {
  story: Story;
  run: FeatureRun;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const isLive = isStoryLive(story);
  const statusColor = STATUS_COLORS[story.status];
  const subSteps = describeStorySubSteps(story, run);

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-card-hover transition-colors flex flex-col gap-1.5 relative"
      style={isLive ? { boxShadow: 'inset 0 0 0 1px rgba(34, 197, 94, 0.45)' } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted text-[10px] font-mono w-8 shrink-0">
          {index}/{total}
        </span>
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
        />
        <span className="font-mono text-[11px] text-link">{story.key}</span>
        <span className="text-fg text-xs flex-1 truncate">{story.title}</span>
        {isLive && <LivePill />}
        {!isLive && (
          <span className="text-muted text-[10px] font-mono uppercase tracking-wide">
            {story.status}
          </span>
        )}
        <span className="text-muted text-[11px] font-mono ml-2 shrink-0">
          {story.timing.durationMs > 0
            ? formatDuration(story.timing.durationMs)
            : '—'}
        </span>
      </div>

      {subSteps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 ml-10">
          {subSteps.map((s, i) => (
            <SubStepChip key={i} step={s} />
          ))}
        </div>
      )}

      {story.tokens.input > 0 && (
        <div className="ml-10">
          <TokenBar tokens={story.tokens} width={240} />
        </div>
      )}

      {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
    </button>
  );
}

function isStoryLive(story: Story): boolean {
  return (
    story.status === 'analyzing' ||
    story.status === 'implementing' ||
    story.status === 'verifying'
  );
}

function LivePill() {
  return (
    <span
      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-[1px] rounded"
      style={{
        background: '#22c55e',
        color: '#000',
        boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
        animation: 'skill-flow-pulse 1.6s ease-in-out infinite'
      }}
    >
      live
    </span>
  );
}

interface SubStep {
  kind: 'agent' | 'tool' | 'verify';
  agent?: AgentName;
  toolName?: string;
  count: number;
  inProgress?: boolean;
  outcome?: 'matched' | 'capped' | 'fixed';
}

function describeStorySubSteps(story: Story, run: FeatureRun): SubStep[] {
  const out: SubStep[] = [];
  // Phase 5 story rows show only what happened DURING Phase 5 for this story.
  // agent-figma (Phase 2) and agent-analyzer (Phase 3) are tagged with the
  // same storyKey, but their work belongs to those earlier phases — they
  // already appear summarized in the Phase 2 / Phase 3 cards.
  const storyEvents = run.events.filter(
    (e) =>
      'storyKey' in e &&
      (e as { storyKey?: string }).storyKey === story.key &&
      'phaseId' in e &&
      (e as { phaseId?: string }).phaseId === 'phase-5'
  );

  // Tool calls grouped by tool name
  const toolCounts = new Map<string, number>();
  for (const e of storyEvents) {
    if (e.kind === 'tool.call') {
      toolCounts.set(e.toolName, (toolCounts.get(e.toolName) ?? 0) + 1);
    }
  }
  for (const [name, count] of toolCounts) {
    out.push({ kind: 'tool', toolName: name, count });
  }

  // Agent invocations grouped by type
  const agentCounts = new Map<AgentName, { count: number; inProgress: boolean }>();
  const startsById = new Map<string, RunEvent>();
  for (const e of storyEvents) {
    if (e.kind === 'agent.start') {
      startsById.set(e.eventId, e);
    }
  }
  for (const e of storyEvents) {
    if (e.kind === 'agent.start') {
      const cur = agentCounts.get(e.agentType) ?? { count: 0, inProgress: false };
      cur.count += 1;
      // Mark in-progress if no matching agent.end exists yet
      const hasEnd = run.events.some(
        (ev) => ev.kind === 'agent.end' && ev.refEventId === e.eventId
      );
      if (!hasEnd) cur.inProgress = true;
      agentCounts.set(e.agentType, cur);
    }
  }
  for (const [agent, info] of agentCounts) {
    out.push({
      kind: 'agent',
      agent,
      count: info.count,
      inProgress: info.inProgress
    });
  }

  return out;
}

function SubStepChip({ step }: { step: SubStep }) {
  if (step.kind === 'agent' && step.agent) {
    const c = AGENT_COLORS[step.agent];
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-[1px] rounded"
        style={{
          background: step.inProgress ? c.bg : 'transparent',
          color: step.inProgress ? c.fg : c.bg,
          border: `1px solid ${c.bg}`,
          animation: step.inProgress ? 'skill-flow-pulse 1.6s ease-in-out infinite' : undefined
        }}
        title={`${step.agent} × ${step.count}${step.inProgress ? ' (running)' : ''}`}
      >
        {c.label}
        {step.count > 1 && <span>× {step.count}</span>}
      </span>
    );
  }
  if (step.kind === 'tool' && step.toolName) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono text-muted px-1.5 py-[1px] rounded border border-border"
        title={`${step.toolName} × ${step.count}`}
      >
        {step.toolName}
        {step.count > 1 && <span>× {step.count}</span>}
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status badge (left-side phase number)
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  number
}: {
  status: Phase['status'];
  number: string;
}) {
  const cfg = STATUS_BADGE_CFG[status];
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono shrink-0"
      style={{
        background: cfg.bg,
        color: cfg.fg,
        border: `1px solid ${cfg.border}`
      }}
    >
      {cfg.glyph ?? number}
    </div>
  );
}

const STATUS_BADGE_CFG: Record<
  Phase['status'],
  { bg: string; fg: string; border: string; glyph?: string }
> = {
  pending: {
    bg: 'transparent',
    fg: 'var(--vscode-descriptionForeground)',
    border: 'var(--vscode-panel-border)'
  },
  running: {
    bg: '#22c55e',
    fg: '#000000',
    border: '#22c55e'
  },
  completed: {
    bg: 'transparent',
    fg: 'var(--vscode-testing-iconPassed)',
    border: 'var(--vscode-testing-iconPassed)',
    glyph: '✓'
  },
  skipped: {
    bg: 'transparent',
    fg: 'var(--vscode-descriptionForeground)',
    border: 'var(--vscode-descriptionForeground)',
    glyph: '–'
  },
  failed: {
    bg: 'transparent',
    fg: 'var(--vscode-errorForeground)',
    border: 'var(--vscode-errorForeground)',
    glyph: '!'
  }
};
