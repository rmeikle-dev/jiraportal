import * as vscode from 'vscode';
import { isConfigured } from './jira';

class JiraEntryItem extends vscode.TreeItem {
  constructor() {
    super('Open Jira Browser', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('search');
    this.command = {
      command: 'axonFeatureBuilder.openJiraBrowser',
      title: 'Open Jira Browser'
    };
  }
}

class JiraNotConfiguredItem extends vscode.TreeItem {
  constructor() {
    super('Jira not configured', vscode.TreeItemCollapsibleState.None);
    this.description = 'set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN';
    this.iconPath = new vscode.ThemeIcon('warning');
    this.tooltip = 'Set the Jira env vars and reload the window.';
  }
}

export class JiraTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(item: vscode.TreeItem) {
    return item;
  }

  getChildren(): vscode.TreeItem[] {
    return isConfigured() ? [new JiraEntryItem()] : [new JiraNotConfiguredItem()];
  }
}
