import * as vscode from 'vscode';
import { ActiveFeaturesProvider } from './activeFeaturesProvider';
import { JiraTreeProvider } from './jiraTreeProvider';
import { JiraBrowserPanel } from './jiraBrowserPanel';
import { buildFeature } from './launcher';
import { checkForUpdates } from './updater';

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const activeFeatures = new ActiveFeaturesProvider(workspaceRoot);
  const jira = new JiraTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('jiraPortal.activeFeatures', activeFeatures),
    vscode.window.registerTreeDataProvider('jiraPortal.jira', jira),
    vscode.commands.registerCommand('jiraPortal.openJiraBrowser', () =>
      JiraBrowserPanel.show(context)
    ),
    vscode.commands.registerCommand('jiraPortal.refreshActiveFeatures', () =>
      activeFeatures.refresh()
    ),
    vscode.commands.registerCommand('jiraPortal.buildFeature', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Jira feature key',
        placeHolder: 'e.g. AX-966',
        validateInput: (v) => (/^[A-Z]+-\d+$/.test(v) ? null : 'Format: KEY-123')
      });
      if (key) await buildFeature(key);
    }),
    vscode.commands.registerCommand('jiraPortal.checkForUpdates', () =>
      checkForUpdates(context, { force: true })
    ),
    activeFeatures
  );

  JiraBrowserPanel.show(context);
  void checkForUpdates(context);
}

export function deactivate() {}
