import * as vscode from 'vscode';
import { ActiveFeaturesProvider } from './activeFeaturesProvider';
import { JiraTreeProvider } from './jiraTreeProvider';
import { JiraBrowserPanel } from './jiraBrowserPanel';
import { buildFeature } from './launcher';

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const activeFeatures = new ActiveFeaturesProvider(workspaceRoot);
  const jira = new JiraTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('axonFeatureBuilder.activeFeatures', activeFeatures),
    vscode.window.registerTreeDataProvider('axonFeatureBuilder.jira', jira),
    vscode.commands.registerCommand('axonFeatureBuilder.openJiraBrowser', () =>
      JiraBrowserPanel.show(context)
    ),
    vscode.commands.registerCommand('axonFeatureBuilder.refreshActiveFeatures', () =>
      activeFeatures.refresh()
    ),
    vscode.commands.registerCommand('axonFeatureBuilder.buildFeature', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Jira feature key',
        placeHolder: 'e.g. AX-966',
        validateInput: (v) => (/^[A-Z]+-\d+$/.test(v) ? null : 'Format: KEY-123')
      });
      if (key) await buildFeature(key);
    }),
    activeFeatures
  );

  JiraBrowserPanel.show(context);
}

export function deactivate() {}
