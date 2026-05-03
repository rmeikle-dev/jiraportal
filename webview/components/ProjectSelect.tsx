import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Folder } from 'lucide-react';
import type { JiraProject } from '../../src/jira';

interface Props {
  projects: JiraProject[];
  selected: string | null; // project key or null = all
  onChange: (key: string | null) => void;
}

export function ProjectSelect({ projects, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const selectedProject = projects.find((p) => p.key === selected);
  const label = selectedProject
    ? `${selectedProject.name} (${selectedProject.key})`
    : 'All projects';

  return (
    <div ref={ref} className="relative w-64">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-input-border bg-input px-4 py-3 text-sm text-input-fg transition-colors hover:border-accent"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Folder size={14} className="shrink-0 text-muted" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-80 overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          <Option
            label="All projects"
            sublabel={null}
            active={selected === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {projects.length > 0 && <div className="my-1 border-t border-border" />}
          {projects.map((p) => (
            <Option
              key={p.key}
              label={p.name}
              sublabel={p.key}
              active={selected === p.key}
              onClick={() => {
                onChange(p.key);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  sublabel,
  active,
  onClick
}: {
  label: string;
  sublabel: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-card-hover"
    >
      <Check
        size={14}
        className={`shrink-0 ${active ? 'text-accent' : 'opacity-0'}`}
      />
      <span className="min-w-0 flex-1 truncate text-fg">{label}</span>
      {sublabel && (
        <span className="shrink-0 font-mono text-xs text-muted">{sublabel}</span>
      )}
    </button>
  );
}
