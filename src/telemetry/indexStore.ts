import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { RunIndex, RunIndexEntry } from './types';

// The cross-repo index lives at ~/.claude/feature-runs/index.json. The skill's
// telemetry CLI writes it; we only read + watch it. Each entry carries an
// absolute `dataPath` to the run's directory so we don't need to glob workspace
// folders to find runs.

const INDEX_DIR = path.join(os.homedir(), '.claude', 'feature-runs');
const INDEX_FILE = path.join(INDEX_DIR, 'index.json');

export class IndexStore implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private listeners = new Set<(entries: RunIndexEntry[]) => void>();

  /** Returns entries sorted by startedAt desc, with stale entries (missing dataPath) dropped. */
  list(): RunIndexEntry[] {
    if (!fs.existsSync(INDEX_FILE)) return [];
    let parsed: RunIndex;
    try {
      parsed = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) as RunIndex;
    } catch {
      return [];
    }
    if (!parsed || !Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter((e) => e && e.dataPath && fs.existsSync(e.dataPath))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }

  find(runId: string): RunIndexEntry | undefined {
    return this.list().find((e) => e.runId === runId);
  }

  /** Subscribe to index changes — fires on add/remove/update. Lazily creates a watcher. */
  onChange(listener: (entries: RunIndexEntry[]) => void): vscode.Disposable {
    this.listeners.add(listener);
    if (!this.watcher) {
      // FileSystemWatcher requires a glob; use a RelativePattern so we can
      // watch files outside the workspace.
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(INDEX_DIR),
        'index.json'
      );
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const fire = () => this.notifyAll();
      this.watcher.onDidChange(fire);
      this.watcher.onDidCreate(fire);
      this.watcher.onDidDelete(fire);
    }
    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.dispose();
    });
  }

  private notifyAll() {
    const entries = this.list();
    for (const fn of this.listeners) fn(entries);
  }

  dispose() {
    this.watcher?.dispose();
    this.watcher = undefined;
    this.listeners.clear();
  }
}
