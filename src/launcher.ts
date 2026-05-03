import * as vscode from 'vscode';

/**
 * Fires the Claude Code URL handler to open a new tab with the prompt prefilled.
 * Billing flows through the user's logged-in Claude Code session — no API key.
 */
export async function launchInClaudeCode(prompt: string): Promise<void> {
  const uri = vscode.Uri.parse(
    `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(prompt)}`
  );
  await vscode.env.openExternal(uri);
}

export async function buildFeature(featureKey: string): Promise<void> {
  await launchInClaudeCode(`/feature ${featureKey}`);
}

export async function buildStorySelection(storyKeys: string[]): Promise<void> {
  await launchInClaudeCode(`/feature (only stories, ${storyKeys.join(', ')})`);
}
