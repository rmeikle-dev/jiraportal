import { ExternalLink } from 'lucide-react';
import type { FeatureRun } from '../../src/telemetry/types';
import { vscode } from '../vscode-api';
import {
  elapsedMs,
  formatCost,
  formatDuration,
  formatTokens,
  shippedCount
} from './state/derive';
import { TokenBar } from './TokenBar';

export function Header({ run }: { run: FeatureRun }) {
  const total =
    run.totals.inputTokens +
    run.totals.outputTokens +
    run.totals.cacheReadTokens +
    run.totals.cacheCreationTokens;

  return (
    <header className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card">
      <StatusDot status={run.status} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <button
            onClick={() => vscode().postMessage({ type: 'openInJira', url: run.featureUrl })}
            className="font-mono text-sm text-link hover:underline flex items-center gap-1 shrink-0"
            title="Open in Jira"
          >
            {run.featureKey}
            <ExternalLink size={11} />
          </button>
          <span className="text-fg truncate">— {run.featureTitle}</span>
        </div>
        <div className="text-muted text-[11px] font-mono">
          {run.repo.name} · {run.repo.baseBranch}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-6 text-[11px] font-mono">
        <Stat label="stories" value={`${shippedCount(run)}/${run.stories.length}`} />
        <Stat label="elapsed" value={formatDuration(elapsedMs(run))} />
        <Stat label="tools" value={run.totals.toolCalls.toString()} />
        <Stat label="agents" value={run.totals.agentCalls.toString()} />
        <Stat label="tokens" value={formatTokens(total)} />
        <Stat label="cost" value={formatCost(run.totals.costUsd)} />
      </div>

      <div className="ml-2">
        <TokenBar tokens={breakdownFromTotals(run)} width={120} />
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-muted uppercase tracking-wide text-[9px]">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}

function StatusDot({ status }: { status: FeatureRun['status'] }) {
  const cfg: Record<
    FeatureRun['status'],
    { color: string; label: string; pulse: boolean }
  > = {
    running: { color: '#3b82f6', label: 'running', pulse: true },
    completed: { color: 'var(--vscode-testing-iconPassed)', label: 'completed', pulse: false },
    failed: { color: 'var(--vscode-errorForeground)', label: 'failed', pulse: false },
    aborted: { color: 'var(--vscode-descriptionForeground)', label: 'aborted', pulse: false }
  };
  const c = cfg[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${c.pulse ? 'animate-pulse' : ''}`}
        style={{ background: c.color }}
      />
      <span className="text-fg text-[11px] uppercase tracking-wide font-mono">
        {c.label}
      </span>
    </div>
  );
}

function breakdownFromTotals(run: FeatureRun) {
  return {
    input: run.totals.inputTokens,
    output: run.totals.outputTokens,
    cacheRead: run.totals.cacheReadTokens,
    cacheCreation: run.totals.cacheCreationTokens
  };
}
