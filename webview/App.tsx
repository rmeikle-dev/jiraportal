import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Inbox } from 'lucide-react';
import { vscode, type HostToWebview } from './vscode-api';
import { SearchBar } from './components/SearchBar';
import { IssueCard, type ChildState } from './components/IssueCard';
import { ProjectSelect } from './components/ProjectSelect';
import { SelectionBar } from './components/SelectionBar';
import type { JiraIssue, JiraProject } from '../src/jira';

const DEFAULT_JQL = 'issuetype = Feature ORDER BY updated DESC';

function composeJql(projectKey: string | null, baseJql: string): string {
  if (!projectKey) return baseJql;
  // ORDER BY must remain at the end of the whole query, not inside parens.
  const match = baseJql.match(/^(.*?)\s+(ORDER\s+BY\s+.*)$/i);
  const where = (match ? match[1] : baseJql).trim();
  const orderBy = match ? match[2].trim() : '';
  const projectClause = `project = ${projectKey}`;
  const predicate = where ? `${projectClause} AND (${where})` : projectClause;
  return orderBy ? `${predicate} ${orderBy}` : predicate;
}

export function App() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [jql, setJql] = useState(DEFAULT_JQL);
  const [children, setChildren] = useState<Record<string, ChildState>>({});
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onMessage(event: MessageEvent<HostToWebview>) {
      const msg = event.data;
      if (msg.type === 'searching') {
        setState('loading');
        setError(null);
      } else if (msg.type === 'searchResult') {
        setIssues(msg.issues);
        setState('idle');
      } else if (msg.type === 'searchError') {
        setError(msg.message);
        setState('error');
      } else if (msg.type === 'projects') {
        setProjects(msg.projects);
      } else if (msg.type === 'childrenResult') {
        setChildren((c) => ({
          ...c,
          [msg.parentKey]: { state: 'loaded', issues: msg.issues }
        }));
      } else if (msg.type === 'childrenError') {
        setChildren((c) => ({
          ...c,
          [msg.parentKey]: { state: 'error', message: msg.message }
        }));
      }
    }
    window.addEventListener('message', onMessage);
    vscode().postMessage({ type: 'requestProjects' });
    runSearch(null, DEFAULT_JQL);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(projectKey: string | null, baseJql: string) {
    setChildren({}); // reset expansions on new search
    vscode().postMessage({ type: 'search', jql: composeJql(projectKey, baseJql) });
  }

  function onProjectChange(key: string | null) {
    setSelectedProject(key);
    runSearch(key, jql);
  }

  function onSearchSubmit(newJql: string) {
    setJql(newJql);
    runSearch(selectedProject, newJql);
  }

  function onToggleExpand(parentKey: string) {
    const current = children[parentKey];
    if (current && current.state !== 'collapsed') {
      setChildren((c) => ({ ...c, [parentKey]: { state: 'collapsed' } }));
      return;
    }
    setChildren((c) => ({ ...c, [parentKey]: { state: 'loading' } }));
    vscode().postMessage({ type: 'requestChildren', parentKey });
  }

  function onToggleStory(key: string) {
    setSelectedStories((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onClearSelection() {
    setSelectedStories(new Set());
  }

  function onBuildSelection() {
    const keys = Array.from(selectedStories);
    if (keys.length === 0) return;
    vscode().postMessage({ type: 'buildSelection', storyKeys: keys });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-10 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Jira Browser</h1>
        <p className="text-base text-muted">
          Find a feature, click <span className="text-fg">Build with Claude</span> — opens
          Claude Code with <code className="rounded bg-card px-1.5 py-0.5 text-sm">/feature {'{KEY}'}</code> ready to send.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <ProjectSelect
          projects={projects}
          selected={selectedProject}
          onChange={onProjectChange}
        />
        <div className="min-w-0 flex-1">
          <SearchBar initialJql={DEFAULT_JQL} onSearch={onSearchSubmit} />
        </div>
      </div>

      <Body
        state={state}
        error={error}
        issues={issues}
        children={children}
        selectedStories={selectedStories}
        onBuild={(key) => vscode().postMessage({ type: 'build', key })}
        onOpen={(url) => vscode().postMessage({ type: 'openInJira', url })}
        onToggleExpand={onToggleExpand}
        onToggleStory={onToggleStory}
      />

      <SelectionBar
        selected={Array.from(selectedStories)}
        onRemove={onToggleStory}
        onClear={onClearSelection}
        onBuild={onBuildSelection}
      />
    </div>
  );
}

function Body({
  state,
  error,
  issues,
  children,
  selectedStories,
  onBuild,
  onOpen,
  onToggleExpand,
  onToggleStory
}: {
  state: 'idle' | 'loading' | 'error';
  error: string | null;
  issues: JiraIssue[];
  children: Record<string, ChildState>;
  selectedStories: Set<string>;
  onBuild: (key: string) => void;
  onOpen: (url: string) => void;
  onToggleExpand: (key: string) => void;
  onToggleStory: (key: string) => void;
}) {
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Searching Jira…
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-md border border-error/30 bg-error/5 p-4 text-sm">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-error" />
        <div className="space-y-1">
          <div className="font-medium text-error">Couldn't reach Jira</div>
          <div className="text-muted">{error}</div>
        </div>
      </div>
    );
  }
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <Inbox size={32} className="mb-3 opacity-50" />
        <div className="text-sm">No matching issues.</div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {issues.map((issue) => (
        <IssueCard
          key={issue.key}
          issue={issue}
          childState={children[issue.key] ?? { state: 'collapsed' }}
          selectedStories={selectedStories}
          onBuild={onBuild}
          onOpen={onOpen}
          onToggleExpand={onToggleExpand}
          onToggleStory={onToggleStory}
        />
      ))}
    </div>
  );
}
