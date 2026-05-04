import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { searchIssues, listProjects, listChildren, JiraConfigError } from './jira';
import { buildFeature, buildStorySelection } from './launcher';
import type { WebviewToHost, HostToWebview } from './messages';

export class JiraBrowserPanel {
  private static current: JiraBrowserPanel | undefined;

  static show(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (JiraBrowserPanel.current) {
      JiraBrowserPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'jiraPortalBrowser',
      'Jira Browser',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))]
      }
    );
    JiraBrowserPanel.current = new JiraBrowserPanel(panel, context);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
  ) {
    this.panel.webview.html = this.render();
    this.panel.onDidDispose(() => {
      JiraBrowserPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((msg: WebviewToHost) =>
      this.handleMessage(msg)
    );
  }

  private send(msg: HostToWebview) {
    this.panel.webview.postMessage(msg);
  }

  private errorMessage(err: unknown): string {
    if (err instanceof JiraConfigError) {
      return 'Jira env vars not set (JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN). Set them and reload the window.';
    }
    return err instanceof Error ? err.message : String(err);
  }

  private async handleMessage(msg: WebviewToHost) {
    switch (msg.type) {
      case 'search':
        this.send({ type: 'searching' });
        try {
          const issues = await searchIssues(msg.jql);
          this.send({ type: 'searchResult', issues });
        } catch (err) {
          this.send({ type: 'searchError', message: this.errorMessage(err) });
        }
        return;
      case 'requestProjects':
        try {
          const projects = await listProjects();
          this.send({ type: 'projects', projects });
        } catch {
          // Silent — UI falls back to "All projects" only.
        }
        return;
      case 'requestChildren':
        try {
          const issues = await listChildren(msg.parentKey);
          this.send({ type: 'childrenResult', parentKey: msg.parentKey, issues });
        } catch (err) {
          this.send({
            type: 'childrenError',
            parentKey: msg.parentKey,
            message: this.errorMessage(err)
          });
        }
        return;
      case 'build':
        await buildFeature(msg.key);
        vscode.window.showInformationMessage(
          `Opening Claude Code with /jira-feature-builder ${msg.key}`
        );
        return;
      case 'buildSelection':
        await buildStorySelection(msg.storyKeys);
        vscode.window.showInformationMessage(
          `Opening Claude Code with ${msg.storyKeys.length} selected stor${msg.storyKeys.length === 1 ? 'y' : 'ies'}`
        );
        return;
      case 'openInJira':
        await vscode.env.openExternal(vscode.Uri.parse(msg.url));
        return;
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
  <title>Jira Browser</title>
</head>
<body>
  <div id="root"></div>
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
