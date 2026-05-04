import type { AgentName } from '../../src/telemetry/types';
import { AGENT_COLORS } from './state/derive';

export function AgentBadge({ agent, size = 'sm' }: { agent: AgentName; size?: 'sm' | 'xs' }) {
  const c = AGENT_COLORS[agent];
  const cls =
    size === 'xs'
      ? 'text-[9px] px-1 py-[1px] rounded'
      : 'text-[10px] px-1.5 py-[2px] rounded';
  return (
    <span
      className={`${cls} font-mono uppercase tracking-wide`}
      style={{ background: c.bg, color: c.fg }}
      title={agent}
    >
      {c.label}
    </span>
  );
}

export function AgentDot({ agent }: { agent: AgentName }) {
  const c = AGENT_COLORS[agent];
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: c.bg }}
      title={agent}
    />
  );
}
