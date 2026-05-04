import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { Event as RunEvent, FeatureRun } from './types';

// RunReader handles two cooperating data sources for one run directory:
//
//   run.json       — denormalized snapshot. Updated by the orchestrator's
//                    telemetry CLI on phase boundaries and structured patches
//                    (set-stories / set-story / set-graph / set-meta).
//   events.jsonl   — append-only event log. Updated by the orchestrator AND
//                    by Claude Code hooks (tool.call / tool.result /
//                    agent.start / agent.end), so high-frequency.
//
// The webview reducer is idempotent on `eventId`, so re-sending events that
// already came in via a snapshot is a no-op. We use that to keep the host
// logic simple: emit a fresh snapshot whenever run.json changes, and a
// delta whenever new lines appear in events.jsonl. The reducer reconciles.

const SNAPSHOT_DEBOUNCE_MS = 150;
const EVENTS_DEBOUNCE_MS = 80;

export class RunReader implements vscode.Disposable {
  private snapshotWatcher: vscode.FileSystemWatcher | undefined;
  private snapshotDebounce: NodeJS.Timeout | undefined;
  private snapshotListeners = new Set<(run: FeatureRun) => void>();

  private eventsWatcher: vscode.FileSystemWatcher | undefined;
  private eventsDebounce: NodeJS.Timeout | undefined;
  private eventsListeners = new Set<(events: RunEvent[]) => void>();
  private eventsByteOffset = 0;

  constructor(private readonly runDir: string) {}

  // -- snapshot (run.json) --

  load(): FeatureRun | null {
    const file = path.join(this.runDir, 'run.json');
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as FeatureRun;
    } catch {
      return null;
    }
  }

  onChange(listener: (run: FeatureRun) => void): vscode.Disposable {
    this.snapshotListeners.add(listener);
    if (!this.snapshotWatcher) {
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(this.runDir),
        'run.json'
      );
      this.snapshotWatcher = vscode.workspace.createFileSystemWatcher(pattern);
      const schedule = () => this.scheduleSnapshotNotify();
      this.snapshotWatcher.onDidChange(schedule);
      this.snapshotWatcher.onDidCreate(schedule);
    }
    return new vscode.Disposable(() => {
      this.snapshotListeners.delete(listener);
      if (this.snapshotListeners.size === 0) this.disposeSnapshotWatcher();
    });
  }

  private scheduleSnapshotNotify() {
    if (this.snapshotDebounce) clearTimeout(this.snapshotDebounce);
    this.snapshotDebounce = setTimeout(() => {
      const run = this.load();
      if (!run) return;
      for (const fn of this.snapshotListeners) fn(run);
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  // -- events tail (events.jsonl) --

  /** Read all events currently in events.jsonl (used to seed initial state). */
  loadAllEvents(): RunEvent[] {
    const file = path.join(this.runDir, 'events.jsonl');
    if (!fs.existsSync(file)) return [];
    const stat = fs.statSync(file);
    this.eventsByteOffset = stat.size;
    const text = fs.readFileSync(file, 'utf8');
    return parseEventLines(text);
  }

  /**
   * Subscribe to new events appended to events.jsonl after the current
   * byte offset. Listeners receive only the *new* events on each fire.
   */
  onEventsAppend(listener: (events: RunEvent[]) => void): vscode.Disposable {
    this.eventsListeners.add(listener);
    if (!this.eventsWatcher) {
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(this.runDir),
        'events.jsonl'
      );
      this.eventsWatcher = vscode.workspace.createFileSystemWatcher(pattern);
      const schedule = () => this.scheduleEventsTail();
      this.eventsWatcher.onDidChange(schedule);
      this.eventsWatcher.onDidCreate(schedule);
    }
    return new vscode.Disposable(() => {
      this.eventsListeners.delete(listener);
      if (this.eventsListeners.size === 0) this.disposeEventsWatcher();
    });
  }

  private scheduleEventsTail() {
    if (this.eventsDebounce) clearTimeout(this.eventsDebounce);
    this.eventsDebounce = setTimeout(() => {
      const newEvents = this.readEventsFromOffset();
      if (newEvents.length === 0) return;
      for (const fn of this.eventsListeners) fn(newEvents);
    }, EVENTS_DEBOUNCE_MS);
  }

  private readEventsFromOffset(): RunEvent[] {
    const file = path.join(this.runDir, 'events.jsonl');
    if (!fs.existsSync(file)) return [];
    const stat = fs.statSync(file);
    if (stat.size <= this.eventsByteOffset) {
      // File truncated or unchanged — reset offset if file shrank.
      if (stat.size < this.eventsByteOffset) this.eventsByteOffset = 0;
      return [];
    }
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(stat.size - this.eventsByteOffset);
      fs.readSync(fd, buf, 0, buf.length, this.eventsByteOffset);
      this.eventsByteOffset = stat.size;
      return parseEventLines(buf.toString('utf8'));
    } finally {
      fs.closeSync(fd);
    }
  }

  // -- disposal --

  private disposeSnapshotWatcher() {
    this.snapshotWatcher?.dispose();
    this.snapshotWatcher = undefined;
    if (this.snapshotDebounce) clearTimeout(this.snapshotDebounce);
    this.snapshotDebounce = undefined;
  }

  private disposeEventsWatcher() {
    this.eventsWatcher?.dispose();
    this.eventsWatcher = undefined;
    if (this.eventsDebounce) clearTimeout(this.eventsDebounce);
    this.eventsDebounce = undefined;
    this.eventsByteOffset = 0;
  }

  dispose() {
    this.disposeSnapshotWatcher();
    this.disposeEventsWatcher();
    this.snapshotListeners.clear();
    this.eventsListeners.clear();
  }
}

function parseEventLines(text: string): RunEvent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as RunEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is RunEvent => e !== null);
}
