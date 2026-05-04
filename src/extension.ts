import * as vscode from 'vscode';
import { JiraBrowserPanel } from './jiraBrowserPanel';
import { FeatureRunsPanel } from './featureRunsPanel';
import { FeatureRunsTreeProvider } from './featureRunsTreeProvider';
import { JiraTreeProvider } from './jiraTreeProvider';
import { IndexStore } from './telemetry/indexStore';
import { buildFeature } from './launcher';
import { checkForUpdates } from './updater';

export function activate(context: vscode.ExtensionContext) {
  const featureRunsTreeProvider = new FeatureRunsTreeProvider();

  context.subscriptions.push(
    featureRunsTreeProvider,
    vscode.window.registerTreeDataProvider('jiraPortal.jira', new JiraTreeProvider()),
    vscode.window.registerTreeDataProvider(
      'jiraPortal.featureRuns',
      featureRunsTreeProvider
    ),
    vscode.commands.registerCommand('jiraPortal.openJiraBrowser', () =>
      JiraBrowserPanel.show(context)
    ),
    vscode.commands.registerCommand(
      'jiraPortal.openFeatureRuns',
      (runId?: string) => {
        // Default behaviour (no arg from palette): open the most recent real run,
        // falling back to the bundled fixture if there are none.
        if (!runId) {
          const indexStore = new IndexStore();
          const recent = indexStore.list()[0];
          indexStore.dispose();
          runId = recent ? recent.runId : 'fixture';
        }
        FeatureRunsPanel.show(context, runId);
      }
    ),
    vscode.commands.registerCommand('jiraPortal.refreshFeatureRuns', () =>
      featureRunsTreeProvider.refresh()
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
