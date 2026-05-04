import type { Phase } from '../../src/telemetry/types';
import { formatDuration } from './state/derive';

const PHASE_ICONS: Record<string, string> = {
  'phase-1': '1',
  'phase-2': '2',
  'phase-3': '3',
  'phase-4': '4',
  'phase-5': '5',
  'phase-6': '6'
};

export function PhasesRail({
  phases,
  onSelectPhase
}: {
  phases: Phase[];
  onSelectPhase: (phaseId: string) => void;
}) {
  return (
    <aside className="w-14 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-2">
      {phases.map((p) => (
        <PhaseChip key={p.id} phase={p} onClick={() => onSelectPhase(p.id)} />
      ))}
    </aside>
  );
}

function PhaseChip({ phase, onClick }: { phase: Phase; onClick: () => void }) {
  const dur =
    phase.startedAt && phase.endedAt
      ? Date.parse(phase.endedAt) - Date.parse(phase.startedAt)
      : phase.startedAt
        ? Date.now() - Date.parse(phase.startedAt)
        : null;

  const cfg = STATE_CFG[phase.status];

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center"
      title={`${phase.name}${dur != null ? ' · ' + formatDuration(dur) : ''}`}
    >
      <div
        className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-mono transition-all ${cfg.pulse ? 'animate-pulse' : ''}`}
        style={{
          background: cfg.bg,
          color: cfg.fg,
          borderColor: cfg.border
        }}
      >
        {PHASE_ICONS[phase.id] ?? '?'}
      </div>
      {dur !== null && (
        <span className="text-[8px] text-muted font-mono mt-1">
          {formatDuration(dur)}
        </span>
      )}
    </button>
  );
}

const STATE_CFG: Record<
  Phase['status'],
  { bg: string; fg: string; border: string; pulse: boolean }
> = {
  pending: {
    bg: 'transparent',
    fg: 'var(--vscode-descriptionForeground)',
    border: 'var(--vscode-panel-border)',
    pulse: false
  },
  running: {
    bg: '#3b82f6',
    fg: '#ffffff',
    border: '#3b82f6',
    pulse: true
  },
  completed: {
    bg: 'var(--vscode-testing-iconPassed)',
    fg: '#ffffff',
    border: 'var(--vscode-testing-iconPassed)',
    pulse: false
  },
  skipped: {
    bg: 'transparent',
    fg: 'var(--vscode-descriptionForeground)',
    border: 'var(--vscode-descriptionForeground)',
    pulse: false
  },
  failed: {
    bg: 'var(--vscode-errorForeground)',
    fg: '#ffffff',
    border: 'var(--vscode-errorForeground)',
    pulse: false
  }
};
