import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = 'rmeikle-dev/jiraportal';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const LAST_CHECK_KEY = 'axonFeatureBuilder.lastUpdateCheck';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export async function checkForUpdates(
  context: vscode.ExtensionContext,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force) {
    const lastCheck = context.globalState.get<number>(LAST_CHECK_KEY) ?? 0;
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  }

  try {
    const current = String(context.extension.packageJSON.version);
    const latest = await fetchLatest();
    void context.globalState.update(LAST_CHECK_KEY, Date.now());
    if (!latest) {
      if (options.force) {
        vscode.window.showInformationMessage('No releases published yet.');
      }
      return;
    }

    const latestVersion = latest.tag_name.replace(/^v/, '');
    if (compareVersions(latestVersion, current) <= 0) {
      if (options.force) {
        vscode.window.showInformationMessage(
          `You're on the latest version (${current}).`
        );
      }
      return;
    }

    const vsix = latest.assets.find((a) => a.name.endsWith('.vsix'));
    if (!vsix) {
      if (options.force) {
        vscode.window.showWarningMessage(
          `Release v${latestVersion} has no .vsix attached.`
        );
      }
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `Axon Feature Builder ${latestVersion} is available (you have ${current}).`,
      'Install update',
      'View release',
      'Later'
    );

    if (choice === 'Install update') {
      await installUpdate(vsix.browser_download_url, vsix.name);
    } else if (choice === 'View release') {
      vscode.env.openExternal(vscode.Uri.parse(latest.html_url));
    }
  } catch (err) {
    if (options.force) {
      vscode.window.showErrorMessage(
        `Update check failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function fetchLatest(): Promise<GitHubRelease | null> {
  const res = await fetch(RELEASES_API, {
    headers: { 'User-Agent': 'axon-feature-builder', Accept: 'application/vnd.github+json' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as GitHubRelease;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function installUpdate(downloadUrl: string, filename: string): Promise<void> {
  const vsixPath = path.join(os.tmpdir(), filename);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Downloading update…' },
    async () => {
      const res = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'axon-feature-builder' }
      });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(vsixPath, buffer);
    }
  );

  try {
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      vscode.Uri.file(vsixPath)
    );
    const reload = await vscode.window.showInformationMessage(
      'Update installed. Reload window to activate.',
      'Reload now'
    );
    if (reload === 'Reload now') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `Couldn't install update: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
