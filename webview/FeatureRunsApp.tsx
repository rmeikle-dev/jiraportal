import { useEffect, useReducer, useState } from 'react';
import type { HostToWebview } from '../src/messages';
import { vscode } from './vscode-api';
import { Header } from './feature-runs/Header';
import { PhasesRail } from './feature-runs/PhasesRail';
import { SkillFlow } from './feature-runs/SkillFlow';
import { Timeline } from './feature-runs/Timeline';
import { DetailDrawer, type Selection } from './feature-runs/DetailDrawer';
import {
  initialRunState,
  runReducer
} from './feature-runs/state/runReducer';

export function FeatureRunsApp() {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent<HostToWebview>) {
      const msg = e.data;
      if (msg.type === 'featureRuns.snapshot') {
        dispatch({ type: 'snapshot', run: msg.run });
        setSelection(null);
      } else if (msg.type === 'featureRuns.eventAppend') {
        dispatch({ type: 'append', events: msg.events });
      }
    }
    window.addEventListener('message', onMessage);
    vscode().postMessage({ type: 'featureRuns.requestSnapshot' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!state.run) return <EmptyState />;

  const run = state.run;
  const selectedStoryKey =
    selection?.kind === 'story' ? selection.storyKey : null;
  const selectedPhaseId =
    selection?.kind === 'phase' ? selection.phaseId : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-fg overflow-hidden">
      <Header run={run} />
      <div className="flex-1 flex min-h-0">
        <PhasesRail
          phases={run.phases}
          onSelectPhase={(phaseId) => setSelection({ kind: 'phase', phaseId })}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <SkillFlow
              run={run}
              selectedStoryKey={selectedStoryKey}
              selectedPhaseId={selectedPhaseId}
              onSelectStory={(storyKey) =>
                setSelection(storyKey ? { kind: 'story', storyKey } : null)
              }
              onSelectPhase={(phaseId) =>
                setSelection(phaseId ? { kind: 'phase', phaseId } : null)
              }
            />
          </div>
          <div className="border-t border-border bg-card">
            <Timeline
              run={run}
              selectedStoryKey={selectedStoryKey}
              onSelectStory={(storyKey) =>
                setSelection(storyKey ? { kind: 'story', storyKey } : null)
              }
              onSelectEvent={(eventId) =>
                setSelection({ kind: 'event', eventId })
              }
            />
          </div>
        </div>
      </div>
      <DetailDrawer
        run={run}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg text-muted">
      <div className="text-sm font-mono">Loading run…</div>
    </div>
  );
}
