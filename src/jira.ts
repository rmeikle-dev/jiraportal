import * as vscode from 'vscode';

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  assignee: string | null;
  url: string;
  updated: string;
}

export interface JiraProject {
  key: string;
  name: string;
}

interface JiraSearchResponse {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      issuetype: { name: string };
      assignee: { displayName: string } | null;
      updated: string;
    };
  }>;
}

export class JiraConfigError extends Error {
  constructor() {
    super('JIRA_URL, JIRA_USERNAME, or JIRA_API_TOKEN env var not set.');
  }
}

function readConfig() {
  const url = process.env.JIRA_URL?.replace(/\/$/, '');
  const username = process.env.JIRA_USERNAME;
  const token = process.env.JIRA_API_TOKEN;
  if (!url || !username || !token) throw new JiraConfigError();
  const auth = Buffer.from(`${username}:${token}`).toString('base64');
  return { url, auth };
}

export async function listProjects(): Promise<JiraProject[]> {
  const { url, auth } = readConfig();
  const res = await fetch(`${url}/rest/api/3/project/search?maxResults=100&orderBy=name`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { values: Array<{ key: string; name: string }> };
  return data.values.map((p) => ({ key: p.key, name: p.name }));
}

export async function listChildren(parentKey: string): Promise<JiraIssue[]> {
  const jql = `parent = "${parentKey}" OR "Epic Link" = ${parentKey} ORDER BY rank ASC`;
  return searchIssues(jql, 100);
}

export async function searchIssues(jql: string, max = 50): Promise<JiraIssue[]> {
  const { url, auth } = readConfig();
  const res = await fetch(`${url}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql,
      maxResults: max,
      fields: ['summary', 'status', 'issuetype', 'assignee', 'updated']
    })
  });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as JiraSearchResponse;
  return data.issues.map((i) => ({
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status.name,
    issueType: i.fields.issuetype.name,
    assignee: i.fields.assignee?.displayName ?? null,
    url: `${url}/browse/${i.key}`,
    updated: i.fields.updated
  }));
}

export function isConfigured(): boolean {
  return !!(process.env.JIRA_URL && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN);
}

export function showConfigError() {
  vscode.window.showErrorMessage(
    'Jira env vars not set. Set JIRA_URL, JIRA_USERNAME, and JIRA_API_TOKEN, then reload the window.'
  );
}
