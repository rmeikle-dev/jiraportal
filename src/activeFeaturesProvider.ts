import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface FeatureSnapshot {
  key: string;
  title?: string;
  contextDir: string;
  storyCount: number;
  pendingCount: number;
}

class FeatureItem extends vscode.TreeItem {
  constructor(public readonly snapshot: FeatureSnapshot) {
    super(snapshot.key, vscode.TreeItemCollapsibleState.None);
    const status =
      snapshot.pendingCount === 0
        ? '✓ done'
        : `${snapshot.storyCount - snapshot.pendingCount}/${snapshot.storyCount} stories`;
    this.description = status;
    this.tooltip = snapshot.title ?? snapshot.key;
    this.iconPath = new vscode.ThemeIcon(
      snapshot.pendingCount === 0 ? 'check-all' : 'sync'
    );
    this.command = {
      command: 'vscode.open',
      title: 'Open PLAN.md',
      arguments: [vscode.Uri.file(path.join(snapshot.contextDir, 'PLAN.md'))]
    };
  }
}

export class ActiveFeaturesProvider
  implements vscode.TreeDataProvider<FeatureItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private watcher: vscode.FileSystemWatcher | undefined;

  constructor(private workspaceRoot: string | undefined) {
    this.setupWatcher();
  }

  private setupWatcher() {
    if (!this.workspaceRoot) return;
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      '.claude-feature-context/*/PLAN.md'
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  dispose() {
    this.watcher?.dispose();
  }

  getTreeItem(item: FeatureItem) {
    return item;
  }

  async getChildren(): Promise<FeatureItem[]> {
    if (!this.workspaceRoot) return [];
    const root = path.join(this.workspaceRoot, '.claude-feature-context');
    if (!fs.existsSync(root)) return [];
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    const features: FeatureSnapshot[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const snap = await this.readFeature(path.join(root, entry.name), entry.name);
      if (snap) features.push(snap);
    }
    features.sort((a, b) => a.key.localeCompare(b.key));
    return features.map((s) => new FeatureItem(s));
  }

  private async readFeature(
    dir: string,
    key: string
  ): Promise<FeatureSnapshot | null> {
    const planPath = path.join(dir, 'PLAN.md');
    if (!fs.existsSync(planPath)) return null;
    const content = await fs.promises.readFile(planPath, 'utf8');
    const titleMatch = content.match(/^#\s+\S+\s+—\s+(.+)$/m);
    const storyLines = content.match(/^\d+\.\s+\S+\s+—.+$/gm) ?? [];
    const pending = storyLines.filter((l) => /_pending_/.test(l)).length;
    return {
      key,
      title: titleMatch?.[1]?.trim(),
      contextDir: dir,
      storyCount: storyLines.length,
      pendingCount: pending
    };
  }
}
