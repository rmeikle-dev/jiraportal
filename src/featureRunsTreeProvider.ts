import * as vscode from 'vscode';
import { IndexStore } from './telemetry/indexStore';
import type { RunIndexEntry } from './telemetry/types';

// Tree of feature runs sourced from ~/.claude/feature-runs/index.json.
// Always shows the bundled fixture entry first so the UI is testable without
// any real runs. Real runs follow, sorted by startedAt desc.

export class FeatureRunsTreeProvider
  implements vscode.TreeDataProvider<RunNode>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private indexStore = new IndexStore();
  private indexSubscription: vscode.Disposable;

  constructor() {
    this.indexSubscription = this.indexStore.onChange(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(node: RunNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.description;
    item.tooltip = node.tooltip;
    item.iconPath = new vscode.ThemeIcon(node.iconId, statusColor(node.status));
    item.contextValue = node.runId === 'fixture' ? 'featureRun.fixture' : 'featureRun.real';
    item.command = {
      command: 'jiraPortal.openFeatureRuns',
      title: 'Open Feature Run',
      arguments: [node.runId]
    };
    return item;
  }

  getChildren(): RunNode[] {
    const fixtureNode: RunNode = {
      runId: 'fixture',
      label: 'Sample fixture',
      description: 'demo · 5 stories',
      tooltip: 'Bundled sample-run.json — open to develop the UI without a live run.',
      status: 'completed',
      iconId: 'beaker'
    };

    const entries = this.indexStore.list();
    const realNodes: RunNode[] = entries.map((e) => ({
      runId: e.runId,
      label: e.featureKey,
      description: shortDescription(e),
      tooltip: tooltipFor(e),
      status: e.status,
      iconId:
        e.status === 'running'
          ? 'pulse'
          : e.status === 'completed'
            ? 'pass'
            : e.status === 'failed' || e.status === 'aborted'
              ? 'error'
              : 'circle-outline'
    }));

    return [fixtureNode, ...realNodes];
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  dispose() {
    this.indexSubscription.dispose();
    this.indexStore.dispose();
  }
}

interface RunNode {
  runId: string;
  label: string;
  description: string;
  tooltip: string;
  status: string;
  iconId: string;
}

function shortDescription(e: RunIndexEntry): string {
  const status = e.status;
  const title = e.featureTitle && e.featureTitle !== e.featureKey ? ` · ${e.featureTitle}` : '';
  const repo = e.repoName ? ` · ${e.repoName}` : '';
  return `${status}${title}${repo}`;
}

function tooltipFor(e: RunIndexEntry): string {
  const lines = [
    `${e.featureKey} — ${e.featureTitle}`,
    `Status: ${e.status}`,
    `Repo: ${e.repoRoot}`,
    `Started: ${formatTs(e.startedAt)}`
  ];
  if (e.endedAt) lines.push(`Ended:   ${formatTs(e.endedAt)}`);
  return lines.join('\n');
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusColor(status: string): vscode.ThemeColor | undefined {
  if (status === 'running') return new vscode.ThemeColor('charts.blue');
  if (status === 'completed') return new vscode.ThemeColor('testing.iconPassed');
  if (status === 'failed' || status === 'aborted')
    return new vscode.ThemeColor('errorForeground');
  return undefined;
}
