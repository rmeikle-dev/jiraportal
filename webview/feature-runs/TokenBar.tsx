import type { TokenBreakdown } from '../../src/telemetry/types';
import { formatTokens } from './state/derive';

// A horizontal stacked bar showing input / output / cache-read / cache-creation
// proportions for a token breakdown. Used in the header and on story nodes.

export function TokenBar({
  tokens,
  width = 160,
  showLabels = false
}: {
  tokens: TokenBreakdown;
  width?: number;
  showLabels?: boolean;
}) {
  const total =
    tokens.input + tokens.output + tokens.cacheRead + tokens.cacheCreation;

  if (total === 0) {
    return (
      <div
        className="text-muted text-[10px] font-mono"
        style={{ width }}
        title="No tokens recorded yet"
      >
        — no tokens —
      </div>
    );
  }

  const seg = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="flex flex-col gap-1" style={{ width }}>
      <div
        className="flex h-1.5 rounded-sm overflow-hidden border border-border"
        title={`${formatTokens(total)} total — input ${formatTokens(
          tokens.input
        )}, output ${formatTokens(tokens.output)}, cache-read ${formatTokens(
          tokens.cacheRead
        )}, cache-creation ${formatTokens(tokens.cacheCreation)}`}
      >
        <div style={{ width: seg(tokens.input), background: '#3b82f6' }} />
        <div style={{ width: seg(tokens.output), background: '#10b981' }} />
        <div style={{ width: seg(tokens.cacheRead), background: '#6b7280' }} />
        <div style={{ width: seg(tokens.cacheCreation), background: '#a855f7' }} />
      </div>
      {showLabels && (
        <div className="flex gap-2 text-[10px] font-mono text-muted">
          <span style={{ color: '#3b82f6' }}>in {formatTokens(tokens.input)}</span>
          <span style={{ color: '#10b981' }}>out {formatTokens(tokens.output)}</span>
          <span>cache {formatTokens(tokens.cacheRead + tokens.cacheCreation)}</span>
        </div>
      )}
    </div>
  );
}
