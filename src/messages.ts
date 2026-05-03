import type { JiraIssue, JiraProject } from './jira';

// Webview → extension host
export type WebviewToHost =
  | { type: 'search'; jql: string }
  | { type: 'requestProjects' }
  | { type: 'requestChildren'; parentKey: string }
  | { type: 'build'; key: string }
  | { type: 'buildSelection'; storyKeys: string[] }
  | { type: 'openInJira'; url: string };

// Extension host → webview
export type HostToWebview =
  | { type: 'searching' }
  | { type: 'searchResult'; issues: JiraIssue[] }
  | { type: 'searchError'; message: string }
  | { type: 'projects'; projects: JiraProject[] }
  | { type: 'childrenResult'; parentKey: string; issues: JiraIssue[] }
  | { type: 'childrenError'; parentKey: string; message: string };
