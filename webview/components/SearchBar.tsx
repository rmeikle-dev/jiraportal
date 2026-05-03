import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface Props {
  initialJql: string;
  onSearch: (jql: string) => void;
}

const PRESETS: Array<{ label: string; jql: string }> = [
  { label: 'My open features', jql: 'assignee = currentUser() AND issuetype = Feature AND statusCategory != Done ORDER BY updated DESC' },
  { label: 'All features', jql: 'issuetype = Feature ORDER BY summary ASC' },
  { label: 'My active stories', jql: 'assignee = currentUser() AND statusCategory = "In Progress" ORDER BY updated DESC' },
  { label: 'Recently updated', jql: 'ORDER BY updated DESC' }
];

export function SearchBar({ initialJql, onSearch }: Props) {
  const [jql, setJql] = useState(initialJql);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSearch(jql.trim());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={jql}
          onChange={(e) => setJql(e.target.value)}
          placeholder="JQL — e.g. project = AX AND issuetype = Feature ORDER BY updated DESC"
          className="w-full rounded-lg border border-input-border bg-input py-3 pl-11 pr-4 font-mono text-sm text-input-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setJql(p.jql);
              onSearch(p.jql);
            }}
            className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
