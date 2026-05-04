import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { WebviewToHost, HostToWebview } from './messages';
import type { FeatureRun } from './telemetry/types';
import { IndexStore } from './telemetry/indexStore';
import { RunReader } from './telemetry/runReader';

// Singleton panel that hosts the FeatureRunsApp webview. Accepts a runId:
//   - "fixture" → loads the bundled sample-run.json (UI dev mode)
//   - any real runId → looks up dataPath in the global index, snapshots run.json,
//     subscribes to live changes via FileSystemWatcher.

const FIXTURE_RUN_ID = 'fixture';
const FIXTURE_FILENAME = 'sample-run.json';

export class FeatureRunsPanel {
  private static current: FeatureRunsPanel | undefined;

  static show(context: vscode.ExtensionContext, runId: string = FIXTURE_RUN_ID) {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (FeatureRunsPanel.current) {
      if (FeatureRunsPanel.current.currentRunId !== runId) {
        FeatureRunsPanel.current.swapRun(runId);
      }
      FeatureRunsPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'jiraPortalFeatureRuns',
      'Feature Runs',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))]
      }
    );
    FeatureRunsPanel.current = new FeatureRunsPanel(panel, context, runId);
  }

  private currentRunId: string;
  private runReader: RunReader | undefined;
  private runChangeSub: vscode.Disposable | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    initialRunId: string
  ) {
    this.currentRunId = initialRunId;
    this.panel.webview.html = this.render();
    this.panel.onDidDispose(() => {
      this.disposeRunSubscription();
      FeatureRunsPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((msg: WebviewToHost) =>
      this.handleMessage(msg)
    );
  }

  private send(msg: HostToWebview) {
    this.panel.webview.postMessage(msg);
  }

  private async handleMessage(msg: WebviewToHost) {
    switch (msg.type) {
      case 'featureRuns.requestSnapshot':
        this.sendSnapshotForCurrentRun();
        return;
      case 'featureRuns.openTranscript':
        try {
          const doc = await vscode.workspace.openTextDocument(msg.transcriptPath);
          await vscode.window.showTextDocument(doc, { preview: true });
        } catch (err) {
          vscode.window.showWarningMessage(
            `Could not open transcript at ${msg.transcriptPath}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        return;
      case 'openInJira':
        await vscode.env.openExternal(vscode.Uri.parse(msg.url));
        return;
      default:
        return;
    }
  }

  /** Swap the panel to a different run without disposing it. */
  private swapRun(runId: string) {
    this.disposeRunSubscription();
    this.currentRunId = runId;
    this.sendSnapshotForCurrentRun();
    this.panel.title = runId === FIXTURE_RUN_ID ? 'Feature Runs (fixture)' : 'Feature Runs';
  }

  private sendSnapshotForCurrentRun() {
    if (this.currentRunId === FIXTURE_RUN_ID) {
      const run = this.loadFixtureRun();
      if (run) this.send({ type: 'featureRuns.snapshot', run });
      return;
    }

    const indexStore = new IndexStore();
    try {
      const entry = indexStore.find(this.currentRunId);
      if (!entry) {
        vscode.window.showWarningMessage(
          `Run ${this.currentRunId} not found in ~/.claude/feature-runs/index.json. Falling back to fixture.`
        );
        this.currentRunId = FIXTURE_RUN_ID;
        const run = this.loadFixtureRun();
        if (run) this.send({ type: 'featureRuns.snapshot', run });
        return;
      }

      // Set up live tail.
      //
      // Two pipelines, both feeding the webview's idempotent reducer:
      //   run.json change → snapshot (orchestrator-level updates, full state)
      //   events.jsonl append → eventAppend deltas (hook-emitted tool/agent
      //                         events that the orchestrator never touches)
      //
      // Initial bring-up: send the current snapshot, then push every event
      // currently in the log. The reducer dedupes on eventId, so events that
      // were already in the snapshot's events array are no-ops.
      this.runReader = new RunReader(entry.dataPath);
      const initial = this.runReader.load();
      if (initial) {
        this.send({ type: 'featureRuns.snapshot', run: initial });
      } else {
        vscode.window.showWarningMessage(
          `run.json missing in ${entry.dataPath}. Has the skill written its first event yet?`
        );
      }
      const allEvents = this.runReader.loadAllEvents();
      if (allEvents.length > 0) {
        this.send({ type: 'featureRuns.eventAppend', events: allEvents });
      }
      this.runChangeSub = vscode.Disposable.from(
        this.runReader.onChange((run) => {
          this.send({ type: 'featureRuns.snapshot', run });
        }),
        this.runReader.onEventsAppend((events) => {
          this.send({ type: 'featureRuns.eventAppend', events });
        })
      );
    } finally {
      indexStore.dispose();
    }
  }

  private disposeRunSubscription() {
    this.runChangeSub?.dispose();
    this.runChangeSub = undefined;
    this.runReader?.dispose();
    this.runReader = undefined;
  }

  private loadFixtureRun(): FeatureRun | null {
    const fixturePath = path.join(
      this.context.extensionPath,
      'webview',
      'feature-runs',
      'fixtures',
      FIXTURE_FILENAME
    );
    try {
      const raw = fs.readFileSync(fixturePath, 'utf8');
      return JSON.parse(raw) as FeatureRun;
    } catch (err) {
      vscode.window.showErrorMessage(
        `Could not load sample run fixture: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null;
    }
  }

  private render(): string {
    const distRoot = vscode.Uri.file(path.join(this.context.extensionPath, 'dist'));
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(distRoot, 'webview.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(distRoot, 'webview.css')
    );
    const nonce = randomNonce();
    const csp = [
      `default-src 'none'`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${this.panel.webview.cspSource} 'unsafe-inline'`,
      `font-src ${this.panel.webview.cspSource}`,
      `img-src ${this.panel.webview.cspSource} data:`
    ].join('; ');
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Feature Runs</title>
</head>
<body>
  <div id="root" data-app="featureRuns"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function randomNonce() {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join('');
}
