import { Sparkles, X } from 'lucide-react';

interface Props {
  selected: string[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onBuild: () => void;
}

export function SelectionBar({ selected, onRemove, onClear, onBuild }: Props) {
  if (selected.length === 0) return null;

  return (
    <div className="sticky bottom-6 z-20 mx-auto mt-8 w-full">
      <div className="flex items-center gap-4 rounded-xl border-2 border-accent/40 bg-card p-4 shadow-2xl ring-1 ring-accent/20">
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-xl font-semibold text-fg">{selected.length}</span>
          <span className="text-sm text-muted">selected</span>
        </div>

        <div className="h-8 w-px shrink-0 bg-border" />

        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selected.map((key) => (
            <button
              key={key}
              onClick={() => onRemove(key)}
              className="group inline-flex items-center gap-1.5 rounded-full bg-accent py-1 pl-3 pr-2 font-mono text-xs font-semibold text-accent-fg transition-all hover:bg-error hover:text-white"
              title={`Remove ${key}`}
            >
              {key}
              <X size={12} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <button
          onClick={onClear}
          className="shrink-0 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-card-hover hover:text-fg"
        >
          Clear
        </button>
        <button
          onClick={onBuild}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-md transition-colors hover:bg-accent-hover"
        >
          <Sparkles size={14} />
          Build with Claude
        </button>
      </div>
    </div>
  );
}
