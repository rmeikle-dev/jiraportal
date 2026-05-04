import type { JiraIssue, JiraProject } from './jira';
import type { FeatureRun, Event as RunEvent } from './telemetry/types';

// Webview → extension host
export type WebviewToHost =
  | { type: 'search'; jql: string }
  | { type: 'requestProjects' }
  | { type: 'requestChildren'; parentKey: string }
  | { type: 'build'; key: string }
  | { type: 'buildSelection'; storyKeys: string[] }
  | { type: 'openInJira'; url: string }
  | { type: 'featureRuns.requestSnapshot' }
  | { type: 'featureRuns.openTranscript'; transcriptPath: string };

// Extension host → webview
export type HostToWebview =
  | { type: 'searching' }
  | { type: 'searchResult'; issues: JiraIssue[] }
  | { type: 'searchError'; message: string }
  | { type: 'projects'; projects: JiraProject[] }
  | { type: 'childrenResult'; parentKey: string; issues: JiraIssue[] }
  | { type: 'childrenError'; parentKey: string; message: string }
  | { type: 'featureRuns.snapshot'; run: FeatureRun }
  | { type: 'featureRuns.eventAppend'; events: RunEvent[] };
