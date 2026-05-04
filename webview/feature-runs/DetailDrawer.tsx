import { ExternalLink, X } from 'lucide-react';
import type {
  Event as RunEvent,
  FeatureRun,
  Phase,
  Story,
  VerificationIteration
} from '../../src/telemetry/types';
import { vscode } from '../vscode-api';
import { AgentBadge } from './AgentBadge';
import {
  STATUS_COLORS,
  findEventById,
  formatDuration,
  formatTokens
} from './state/derive';
import { TokenBar } from './TokenBar';

export type Selection =
  | { kind: 'story'; storyKey: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'phase'; phaseId: string }
  | null;

export function DetailDrawer({
  run,
  selection,
  onClose
}: {
  run: FeatureRun;
  selection: Selection;
  onClose: () => void;
}) {
  const open = selection !== null;

  return (
    <aside
      className="fixed top-0 right-0 h-full w-[380px] bg-card border-l border-border shadow-xl transition-transform duration-150 ease-out z-30 flex flex-col"
      style={{
        transform: open ? 'translateX(0)' : 'translateX(100%)'
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-fg text-xs font-mono uppercase tracking-wide">
          {selection?.kind ?? ''}
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-fg p-1"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selection?.kind === 'story' && (
          <StoryDetail story={story(run, selection.storyKey)} run={run} />
        )}
        {selection?.kind === 'event' && (
          <EventDetail event={findEventById(run, selection.eventId)} run={run} />
        )}
        {selection?.kind === 'phase' && (
          <PhaseDetail
            phase={run.phases.find((p) => p.id === selection.phaseId)}
            run={run}
          />
        )}
      </div>
    </aside>
  );
}

function story(run: FeatureRun, key: string): Story | undefined {
  return run.stories.find((s) => s.key === key);
}

// --- Story view ----------------------------------------------------------

function StoryDetail({ story, run }: { story: Story | undefined; run: FeatureRun }) {
  if (!story) return <div className="text-muted">Story not found.</div>;
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: STATUS_COLORS[story.status] }}
        />
        <button
          onClick={() => vscode().postMessage({ type: 'openInJira', url: story.url })}
          className="font-mono text-link hover:underline flex items-center gap-1"
        >
          {story.key} <ExternalLink size={11} />
        </button>
        <span className="text-muted uppercase tracking-wide ml-auto">
          {story.status}
        </span>
      </div>

      <div className="text-fg text-sm">{story.title}</div>

      {story.branch && (
        <Section title="Branch">
          <div className="font-mono text-[11px]">
            <div>{story.branch.name}</div>
            <div className="text-muted">off {story.branch.base}</div>
            {story.branch.createPrUrl && (
              <button
                onClick={() =>
                  vscode().postMessage({
                    type: 'openInJira',
                    url: story.branch!.createPrUrl!
                  })
                }
                className="mt-1 text-link hover:underline flex items-center gap-1"
              >
                Open PR <ExternalLink size={10} />
              </button>
            )}
          </div>
        </Section>
      )}

      {story.dependsOn.length > 0 && (
        <Section title="Depends on">
          {story.dependsOn.map((d, i) => (
            <div key={i} className="font-mono text-[11px]">
              <span className="text-link">{d.storyKey}</span>{' '}
              <span className="text-muted">via</span>{' '}
              <span>{d.viaLabel}</span>{' '}
              <span className="text-muted">({d.kind})</span>
            </div>
          ))}
        </Section>
      )}

      {story.analysis && (
        <>
          <Section title="Intent">{story.analysis.intent}</Section>
          {story.analysis.surfaces.length > 0 && (
            <BulletSection title="Surfaces" items={story.analysis.surfaces} />
          )}
          {story.analysis.behaviors.length > 0 && (
            <BulletSection title="Behaviors" items={story.analysis.behaviors} />
          )}
          {story.analysis.produces.length > 0 && (
            <Section title="Produces">
              <div className="flex flex-wrap gap-1">
                {story.analysis.produces.map((p, i) => (
                  <ConceptChip key={i} name={p.name} kind={p.kind} />
                ))}
              </div>
            </Section>
          )}
          {story.analysis.consumes.length > 0 && (
            <Section title="Consumes">
              <div className="flex flex-wrap gap-1">
                {story.analysis.consumes.map((c, i) => (
                  <ConceptChip key={i} name={c.name} kind={c.kind} />
                ))}
              </div>
            </Section>
          )}
          {story.analysis.ambiguities.length > 0 && (
            <BulletSection title="Ambiguities" items={story.analysis.ambiguities} />
          )}
          {story.analysis.ticketDesignConflicts.length > 0 && (
            <BulletSection
              title="Ticket vs design conflicts"
              items={story.analysis.ticketDesignConflicts}
              accent="warning"
            />
          )}
          {story.analysis.openQuestions.length > 0 && (
            <BulletSection
              title="Open questions"
              items={story.analysis.openQuestions}
            />
          )}
        </>
      )}

      {story.plan && (
        <Section title="Plan">
          <div className="font-mono text-[10px] text-muted mb-1">files</div>
          <ul className="font-mono text-[11px] mb-2 space-y-0.5">
            {story.plan.files.map((f, i) => (
              <li key={i} className="truncate" title={f}>
                {f}
              </li>
            ))}
          </ul>
          {story.plan.notes.length > 0 && (
            <>
              <div className="font-mono text-[10px] text-muted mb-1">notes</div>
              <ul className="space-y-0.5">
                {story.plan.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {story.verification && story.verification.iterations.length > 0 && (
        <Section title={`Verification (${story.verification.finalState ?? 'in progress'})`}>
          <div className="space-y-2">
            {story.verification.iterations.map((iter) => (
              <IterationCard key={iter.index} iter={iter} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Tokens">
        <TokenBar tokens={story.tokens} width={280} showLabels />
      </Section>

      <Section title="Timing">
        <div className="font-mono text-[11px]">
          {formatDuration(story.timing.durationMs)}
        </div>
      </Section>

      {run.session.transcriptPath && (
        <button
          onClick={() =>
            vscode().postMessage({
              type: 'featureRuns.openTranscript',
              transcriptPath: run.session.transcriptPath
            })
          }
          className="mt-2 text-link hover:underline text-[11px] font-mono flex items-center gap-1"
        >
          Open session transcript <ExternalLink size={10} />
        </button>
      )}
    </div>
  );
}

function IterationCard({ iter }: { iter: VerificationIteration }) {
  const dur = Date.parse(iter.endedAt) - Date.parse(iter.startedAt);
  const outcomeColor =
    iter.outcome === 'matched'
      ? 'var(--vscode-testing-iconPassed)'
      : iter.outcome === 'capped'
        ? 'var(--vscode-editorWarning-foreground)'
        : 'var(--vscode-descriptionForeground)';
  return (
    <div className="border border-border rounded p-2 bg-bg">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] text-muted">iter {iter.index}</span>
        <span
          className="text-[10px] uppercase tracking-wide font-mono"
          style={{ color: outcomeColor }}
        >
          {iter.outcome}
        </span>
        <span className="text-[10px] text-muted ml-auto">{formatDuration(dur)}</span>
      </div>
      {iter.discrepancies.length > 0 ? (
        <ul className="text-[11px] space-y-0.5">
          {iter.discrepancies.map((d, i) => (
            <li key={i}>· {d}</li>
          ))}
        </ul>
      ) : (
        <div className="text-[11px] text-muted italic">no discrepancies</div>
      )}
      {iter.fixCommitSha && (
        <div className="font-mono text-[10px] text-muted mt-1">
          fix: {iter.fixCommitSha}
        </div>
      )}
    </div>
  );
}

// --- Event view ----------------------------------------------------------

function EventDetail({ event, run }: { event: RunEvent | undefined; run: FeatureRun }) {
  if (!event) return <div className="text-muted">Event not found.</div>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted uppercase tracking-wide">
          {event.kind}
        </span>
        <span className="text-muted text-[10px] font-mono ml-auto">
          {new Date(event.t).toISOString().split('T')[1]?.slice(0, 8)}
        </span>
      </div>

      {event.kind === 'agent.start' && (
        <>
          <div className="flex items-center gap-2">
            <AgentBadge agent={event.agentType} />
            {event.storyKey && (
              <span className="font-mono text-[11px] text-link">{event.storyKey}</span>
            )}
          </div>
          <Section title="Prompt (digest)">
            <div className="font-mono text-[10px] text-fg whitespace-pre-wrap break-words">
              {event.promptDigest}
            </div>
          </Section>
          {(() => {
            const end = run.events.find(
              (e) => e.kind === 'agent.end' && e.refEventId === event.eventId
            );
            if (!end || end.kind !== 'agent.end') return null;
            return (
              <>
                <Section title={`Result (${end.ok ? 'ok' : 'failed'})`}>
                  <div className="font-mono text-[10px] whitespace-pre-wrap break-words">
                    {end.outputDigest}
                  </div>
                </Section>
                <Section title="Duration">
                  <span className="font-mono">{formatDuration(end.durationMs)}</span>
                </Section>
                {end.tokens && (
                  <Section title="Tokens">
                    <TokenBar tokens={end.tokens} width={280} showLabels />
                    <div className="font-mono text-[10px] mt-1 text-muted">
                      input {formatTokens(end.tokens.input)} ·
                      output {formatTokens(end.tokens.output)} ·
                      cache R/C {formatTokens(end.tokens.cacheRead)}/
                      {formatTokens(end.tokens.cacheCreation)}
                    </div>
                  </Section>
                )}
              </>
            );
          })()}
        </>
      )}

      {event.kind === 'tool.call' && (
        <>
          <div className="font-mono text-[11px]">
            {event.storyKey && (
              <span className="text-link mr-2">{event.storyKey}</span>
            )}
            <span className="text-fg">{event.toolName}</span>
          </div>
          <Section title="Args">
            <pre className="font-mono text-[10px] whitespace-pre-wrap break-words bg-bg p-2 rounded border border-border">
              {JSON.stringify(event.args, null, 2)}
            </pre>
          </Section>
          {(() => {
            const result = run.events.find(
              (e) => e.kind === 'tool.result' && e.refEventId === event.eventId
            );
            if (!result || result.kind !== 'tool.result') return null;
            return (
              <>
                <Section title={`Result (${result.ok ? 'ok' : 'failed'})`}>
                  <div
                    className="font-mono text-[10px] whitespace-pre-wrap break-words"
                    style={{
                      color: result.ok
                        ? 'var(--vscode-editor-foreground)'
                        : 'var(--vscode-errorForeground)'
                    }}
                  >
                    {result.resultDigest}
                  </div>
                </Section>
                <Section title="Duration">
                  <span className="font-mono">{formatDuration(result.durationMs)}</span>
                </Section>
              </>
            );
          })()}
        </>
      )}

      {event.kind === 'note' && (
        <Section title="Note">
          <div className="text-fg">{event.text}</div>
        </Section>
      )}

      {event.kind === 'user.message' && (
        <Section title={event.role === 'user' ? 'User said' : 'Assistant said'}>
          <div className="text-fg whitespace-pre-wrap">{event.textDigest}</div>
        </Section>
      )}

      {event.kind === 'verification.iteration' && (
        <Section title="Iteration">
          <div className="font-mono text-[11px]">
            <span className="text-link mr-2">{event.storyKey}</span>
            iter {event.index} → {event.outcome}
          </div>
        </Section>
      )}

      {event.kind === 'story.status' && (
        <Section title="Status change">
          <div className="font-mono text-[11px]">
            <span className="text-link mr-2">{event.storyKey}</span>
            {event.from} → <span className="text-fg">{event.to}</span>
          </div>
        </Section>
      )}
    </div>
  );
}

// --- Phase view ----------------------------------------------------------

function PhaseDetail({ phase, run }: { phase: Phase | undefined; run: FeatureRun }) {
  if (!phase) return <div className="text-muted">Phase not found.</div>;

  const phaseEvents = run.events.filter(
    (e) => 'phaseId' in e && (e as { phaseId?: string }).phaseId === phase.id
  );
  const agentEvents = phaseEvents.filter((e) => e.kind === 'agent.start');
  const toolEvents = phaseEvents.filter((e) => e.kind === 'tool.call');
  const userMessages = phaseEvents.filter((e) => e.kind === 'user.message');
  const notes = phaseEvents.filter((e) => e.kind === 'note');

  const dur =
    phase.startedAt && phase.endedAt
      ? Date.parse(phase.endedAt) - Date.parse(phase.startedAt)
      : phase.startedAt
        ? Date.now() - Date.parse(phase.startedAt)
        : null;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-link">{phase.id}</span>
        <span className="text-fg">{phase.name}</span>
        <span className="text-muted text-[10px] uppercase tracking-wide ml-auto">
          {phase.status}
        </span>
      </div>

      {dur !== null && (
        <Section title="Duration">
          <span className="font-mono text-[11px]">{formatDuration(dur)}</span>
        </Section>
      )}

      {phase.notes && <Section title="Notes">{phase.notes}</Section>}

      {agentEvents.length > 0 && (
        <Section title={`Agents (${agentEvents.length})`}>
          <ul className="space-y-1">
            {agentEvents.map((e) => {
              if (e.kind !== 'agent.start') return null;
              return (
                <li key={e.eventId} className="flex items-center gap-2">
                  <AgentBadge agent={e.agentType} />
                  {e.storyKey && (
                    <span className="text-link font-mono text-[11px]">
                      {e.storyKey}
                    </span>
                  )}
                  <span className="text-muted text-[10px] font-mono ml-auto">
                    {new Date(e.t).toISOString().split('T')[1]?.slice(0, 8)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {toolEvents.length > 0 && (
        <Section title={`Tool calls (${toolEvents.length})`}>
          <div className="font-mono text-[10px] text-muted">
            {[
              ...new Set(
                toolEvents.map((e) => (e.kind === 'tool.call' ? e.toolName : ''))
              )
            ]
              .filter(Boolean)
              .map((name) => {
                const count = toolEvents.filter(
                  (e) => e.kind === 'tool.call' && e.toolName === name
                ).length;
                return (
                  <div key={name}>
                    {name} × {count}
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {userMessages.length > 0 && (
        <Section title={`User dialogue (${userMessages.length})`}>
          <div className="space-y-1">
            {userMessages.map((m) => {
              if (m.kind !== 'user.message') return null;
              return (
                <div key={m.eventId} className="text-[11px]">
                  <span className="text-muted font-mono mr-1">
                    {m.role}:
                  </span>
                  <span>{m.textDigest}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {notes.length > 0 && (
        <Section title="Notes">
          <ul className="space-y-1">
            {notes.map((n) =>
              n.kind === 'note' ? (
                <li key={n.eventId} className="text-[11px]">
                  · {n.text}
                </li>
              ) : null
            )}
          </ul>
        </Section>
      )}
    </div>
  );
}

// --- Layout primitives ---------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted text-[10px] uppercase tracking-wide mb-1">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function BulletSection({
  title,
  items,
  accent
}: {
  title: string;
  items: string[];
  accent?: 'warning';
}) {
  const color = accent === 'warning' ? 'var(--vscode-editorWarning-foreground)' : undefined;
  return (
    <Section title={title}>
      <ul className="space-y-0.5" style={color ? { color } : undefined}>
        {items.map((item, i) => (
          <li key={i}>· {item}</li>
        ))}
      </ul>
    </Section>
  );
}

function ConceptChip({ name, kind }: { name: string; kind: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] border border-border bg-bg"
      title={`${name} (${kind})`}
    >
      <span>{name}</span>
      <span className="text-muted">·</span>
      <span className="text-muted">{kind}</span>
    </span>
  );
}

