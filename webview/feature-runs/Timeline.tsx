import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureRun } from '../../src/telemetry/types';
import { AGENT_COLORS, agentSpans, formatDuration } from './state/derive';

const ROW_H = 22;
const PHASE_ROW_H = 28;
const LEFT_GUTTER = 110;
const TOP_PADDING = 8;
const BOTTOM_AXIS_H = 22;

const PHASE_COLORS: Record<string, string> = {
  'phase-1': '#64748b',
  'phase-2': '#3b82f6',
  'phase-3': '#10b981',
  'phase-4': '#a855f7',
  'phase-5': '#0ea5e9',
  'phase-6': '#f59e0b'
};

export function Timeline({
  run,
  selectedStoryKey,
  onSelectStory,
  onSelectEvent
}: {
  run: FeatureRun;
  selectedStoryKey: string | null;
  onSelectStory: (storyKey: string | null) => void;
  onSelectEvent: (eventId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const startMs = useMemo(() => Date.parse(run.startedAt), [run.startedAt]);
  const endMs = useMemo(
    () => (run.endedAt ? Date.parse(run.endedAt) : Date.now()),
    [run.endedAt]
  );
  const durMs = Math.max(1, endMs - startMs);

  const trackW = Math.max(0, width - LEFT_GUTTER - 8);
  const xFor = (ms: number) =>
    LEFT_GUTTER + ((Math.max(startMs, Math.min(endMs, ms)) - startMs) / durMs) * trackW;

  const totalRows = 1 + run.stories.length; // phases row + N story rows
  const height =
    TOP_PADDING + PHASE_ROW_H + run.stories.length * ROW_H + BOTTOM_AXIS_H;

  const spans = useMemo(() => agentSpans(run), [run]);

  return (
    <div ref={ref} className="w-full overflow-hidden">
      <svg width={width} height={height} className="block font-mono">
        {/* row background stripes */}
        {Array.from({ length: totalRows }).map((_, i) => (
          <rect
            key={i}
            x={0}
            y={
              TOP_PADDING +
              (i === 0 ? 0 : PHASE_ROW_H + (i - 1) * ROW_H)
            }
            width={width}
            height={i === 0 ? PHASE_ROW_H : ROW_H}
            fill={i % 2 === 0 ? 'var(--vscode-editor-background)' : 'var(--vscode-editorWidget-background)'}
          />
        ))}

        {/* phase bands */}
        {run.phases.map((p) => {
          if (!p.startedAt) return null;
          const x = xFor(Date.parse(p.startedAt));
          const xe = xFor(p.endedAt ? Date.parse(p.endedAt) : endMs);
          const w = Math.max(2, xe - x);
          return (
            <g key={p.id}>
              <rect
                x={x}
                y={TOP_PADDING + 4}
                width={w}
                height={PHASE_ROW_H - 8}
                fill={PHASE_COLORS[p.id]}
                opacity={0.7}
                rx={2}
              />
              <text
                x={x + 4}
                y={TOP_PADDING + PHASE_ROW_H / 2 + 3}
                fill="#ffffff"
                fontSize={10}
                pointerEvents="none"
              >
                {p.name.length > w / 6 ? p.id : p.name}
              </text>
            </g>
          );
        })}

        {/* story row labels */}
        {run.stories.map((s, i) => {
          const y = TOP_PADDING + PHASE_ROW_H + i * ROW_H;
          const isSelected = selectedStoryKey === s.key;
          return (
            <g
              key={s.key}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectStory(isSelected ? null : s.key)}
            >
              <text
                x={6}
                y={y + ROW_H / 2 + 3}
                fontSize={10}
                fill={
                  isSelected
                    ? 'var(--vscode-textLink-foreground)'
                    : 'var(--vscode-editor-foreground)'
                }
                fontWeight={isSelected ? 600 : 400}
              >
                {s.key}
              </text>
              <line
                x1={LEFT_GUTTER}
                x2={width}
                y1={y + ROW_H}
                y2={y + ROW_H}
                stroke="var(--vscode-panel-border)"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* agent spans on story rows */}
        {spans.map((span, i) => {
          if (!span.storyKey) return null;
          const storyIdx = run.stories.findIndex((s) => s.key === span.storyKey);
          if (storyIdx < 0) return null;
          const y = TOP_PADDING + PHASE_ROW_H + storyIdx * ROW_H + 3;
          const x = xFor(span.startMs);
          const xe = xFor(span.endMs);
          const w = Math.max(3, xe - x);
          const color = AGENT_COLORS[span.agentType];
          return (
            <g
              key={`span-${i}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(span.startEvent.eventId);
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={ROW_H - 6}
                fill={color.bg}
                opacity={span.inProgress ? 0.6 : 0.85}
                rx={2}
              >
                <title>
                  {span.agentType} · {formatDuration(span.endMs - span.startMs)}
                  {span.inProgress ? ' (running)' : ''}
                </title>
              </rect>
              {span.inProgress && (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={ROW_H - 6}
                  fill="none"
                  stroke={color.bg}
                  strokeDasharray="3 2"
                  rx={2}
                />
              )}
            </g>
          );
        })}

        {/* tool call ticks on story rows */}
        {run.events.map((e) => {
          if (e.kind !== 'tool.call' || !e.storyKey) return null;
          const storyIdx = run.stories.findIndex((s) => s.key === e.storyKey);
          if (storyIdx < 0) return null;
          const y = TOP_PADDING + PHASE_ROW_H + storyIdx * ROW_H;
          const x = xFor(Date.parse(e.t));
          const isPush = isPushCommand(e.toolName, e.args);
          return (
            <g
              key={e.eventId}
              style={{ cursor: 'pointer' }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectEvent(e.eventId);
              }}
            >
              <line
                x1={x}
                x2={x}
                y1={y + 2}
                y2={y + ROW_H - 2}
                stroke={isPush ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-editor-foreground)'}
                strokeWidth={isPush ? 2 : 1}
                opacity={0.85}
              >
                <title>{`${e.toolName} · ${new Date(e.t).toISOString().split('T')[1]?.slice(0, 8)}`}</title>
              </line>
            </g>
          );
        })}

        {/* current-time cursor */}
        {run.status === 'running' && (
          <line
            x1={xFor(endMs)}
            x2={xFor(endMs)}
            y1={TOP_PADDING}
            y2={height - BOTTOM_AXIS_H}
            stroke="var(--vscode-textLink-foreground)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {/* axis ticks (relative time labels) */}
        <AxisTicks
          startMs={startMs}
          endMs={endMs}
          xFor={xFor}
          y={height - BOTTOM_AXIS_H + 4}
          width={width}
        />
      </svg>
    </div>
  );
}

function isPushCommand(toolName: string, args: unknown): boolean {
  if (toolName !== 'Bash') return false;
  const cmd = (args as { command?: string }).command ?? '';
  return /\bgit\s+push\b/.test(cmd);
}

function AxisTicks({
  startMs,
  endMs,
  xFor,
  y,
  width
}: {
  startMs: number;
  endMs: number;
  xFor: (ms: number) => number;
  y: number;
  width: number;
}) {
  const dur = endMs - startMs;
  const tickEvery = niceTickInterval(dur);
  const ticks: number[] = [];
  for (let t = 0; t <= dur; t += tickEvery) ticks.push(t);

  return (
    <g>
      <line
        x1={LEFT_GUTTER}
        x2={width - 4}
        y1={y - 4}
        y2={y - 4}
        stroke="var(--vscode-panel-border)"
        strokeWidth={0.5}
      />
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={xFor(startMs + t)}
            x2={xFor(startMs + t)}
            y1={y - 6}
            y2={y - 2}
            stroke="var(--vscode-descriptionForeground)"
          />
          <text
            x={xFor(startMs + t)}
            y={y + 8}
            fontSize={9}
            fill="var(--vscode-descriptionForeground)"
            textAnchor="middle"
          >
            {formatDuration(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function niceTickInterval(durMs: number): number {
  // Aim for ~6-8 ticks across the duration.
  const target = durMs / 7;
  const candidates = [
    1_000, 5_000, 10_000, 15_000, 30_000,
    60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000
  ];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return candidates[candidates.length - 1];
}
