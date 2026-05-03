import { Check, ChevronDown, ExternalLink, Loader2, Sparkles, User } from 'lucide-react';
import type { JiraIssue } from '../../src/jira';

export type ChildState =
  | { state: 'collapsed' }
  | { state: 'loading' }
  | { state: 'loaded'; issues: JiraIssue[] }
  | { state: 'error'; message: string };

interface Props {
  issue: JiraIssue;
  childState: ChildState;
  selectedStories: Set<string>;
  onBuild: (key: string) => void;
  onOpen: (url: string) => void;
  onToggleExpand: (key: string) => void;
  onToggleStory: (key: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-success/10 text-success',
  closed: 'bg-success/10 text-success',
  'in progress': 'bg-accent/10 text-accent',
  'in review': 'bg-accent/10 text-accent',
  review: 'bg-accent/10 text-accent',
  'to do': 'bg-muted/10 text-muted',
  open: 'bg-muted/10 text-muted',
  backlog: 'bg-muted/10 text-muted',
  blocked: 'bg-error/10 text-error'
};

function statusClass(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? 'bg-muted/10 text-muted';
}

export function IssueCard({
  issue,
  childState,
  selectedStories,
  onBuild,
  onOpen,
  onToggleExpand,
  onToggleStory
}: Props) {
  const expanded = childState.state !== 'collapsed';
  const childCount =
    childState.state === 'loaded' ? childState.issues.length : null;

  return (
    <div className="group relative rounded-xl border border-border bg-card p-6 transition-all hover:border-accent hover:bg-card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="font-mono font-semibold text-link">{issue.key}</span>
            <span>·</span>
            <span>{issue.issueType}</span>
            <span
              className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${statusClass(
                issue.status
              )}`}
            >
              {issue.status}
            </span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-medium leading-snug text-fg">
            {issue.summary}
          </h3>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <User size={14} />
              {issue.assignee ?? 'Unassigned'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => onBuild(issue.key)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <Sparkles size={14} />
          Build with Claude
        </button>
        <button
          onClick={() => onOpen(issue.url)}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-card-hover"
        >
          <ExternalLink size={14} />
          Open in Jira
        </button>
        <button
          onClick={() => onToggleExpand(issue.key)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-card-hover hover:text-fg"
        >
          {childCount !== null ? `${childCount} stor${childCount === 1 ? 'y' : 'ies'}` : 'Stories'}
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-5 border-t border-border pt-4">
          <Children
            state={childState}
            selectedStories={selectedStories}
            onOpen={onOpen}
            onToggleStory={onToggleStory}
          />
        </div>
      )}
    </div>
  );
}

function Children({
  state,
  selectedStories,
  onOpen,
  onToggleStory
}: {
  state: Exclude<ChildState, { state: 'collapsed' }>;
  selectedStories: Set<string>;
  onOpen: (url: string) => void;
  onToggleStory: (key: string) => void;
}) {
  if (state.state === 'loading') {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" />
        Loading stories…
      </div>
    );
  }
  if (state.state === 'error') {
    return (
      <div className="text-sm text-error">Couldn't load stories: {state.message}</div>
    );
  }
  if (state.issues.length === 0) {
    return <div className="text-sm text-muted">No child stories.</div>;
  }
  return (
    <ul className="space-y-1">
      {state.issues.map((s) => {
        const selected = selectedStories.has(s.key);
        return (
          <li key={s.key}>
            <button
              onClick={() => onToggleStory(s.key)}
              className={`flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left transition-colors ${
                selected
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent hover:bg-card-hover'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  selected
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border bg-transparent'
                }`}
              >
                {selected && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="w-20 shrink-0 font-mono text-xs font-semibold text-link">
                {s.key}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass(
                  s.status
                )}`}
              >
                {s.status}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{s.summary}</span>
              <span className="shrink-0 text-xs text-muted">{s.issueType}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(s.url);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen(s.url);
                  }
                }}
                className="shrink-0 cursor-pointer rounded p-1 text-muted transition-colors hover:bg-card-hover hover:text-fg"
                title="Open in Jira"
              >
                <ExternalLink size={12} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
