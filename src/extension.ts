import * as vscode from 'vscode';
import { JiraBrowserPanel } from './jiraBrowserPanel';
import { JiraTreeProvider } from './jiraTreeProvider';
import { buildFeature } from './launcher';
import { checkForUpdates } from './updater';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('jiraPortal.jira', new JiraTreeProvider()),
    vscode.commands.registerCommand('jiraPortal.openJiraBrowser', () =>
      JiraBrowserPanel.show(context)
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
    )
  );

  JiraBrowserPanel.show(context);
  void checkForUpdates(context);
}

export function deactivate() {}
