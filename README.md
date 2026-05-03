# Jira Portal

VS Code extension that browses Jira features and launches the `/feature` skill in Claude Code with one click. Billing flows through the dev's logged-in Claude Code session — no API key, no per-token charges.

## What you get

- **Jira Browser** (webview tab, opens automatically on startup) — modern card-based UI:
  - JQL search with quick-filter presets ("My open features", "My active stories", etc.)
  - Issue cards with status pill, assignee, type
  - **Build with Claude** button per card → fires `vscode://anthropic.claude-code/open?prompt=/feature%20<KEY>`, opening Claude Code with the prompt prefilled
  - **Open in Jira** button → opens the issue in the browser

The webview themes natively with the editor (light/dark/high-contrast) by binding Tailwind colors to VS Code CSS variables.

## Setup

The extension reuses the same env vars as the `feature` skill — set them in your shell profile:

```powershell
$env:JIRA_URL       = "https://yourcompany.atlassian.net"
$env:JIRA_USERNAME  = "you@company.com"
$env:JIRA_API_TOKEN = "your-token"
```

(Persist via `$PROFILE` or System Environment Variables so VS Code inherits them on launch.)

## Develop

```powershell
npm install
npm run build      # one-shot build
npm run watch      # rebuild on file changes
npm run typecheck  # tsc --noEmit on both projects
```

Press `F5` in VS Code from this folder to launch an Extension Development Host with the extension loaded. The Jira Browser tab opens automatically.

## Package and install

```powershell
npm run package    # produces jira-portal-0.1.0.vsix
```

Then in VS Code: `Extensions → ⋯ menu → Install from VSIX…` and pick the `.vsix`. Or distribute it to the team via a private extension registry / shared folder.

## Architecture

```
src/                          extension host (Node)
├── extension.ts              activation + command registration
├── jira.ts                   REST client, env-var auth
├── launcher.ts               URL handler firing
├── jiraBrowserPanel.ts       webview panel + message routing
└── messages.ts               typed messages between host and webview

webview/                      React app shown inside the panel
├── main.tsx                  React entry
├── App.tsx                   layout, search state, message handling
├── vscode-api.ts             typed acquireVsCodeApi() wrapper
├── components/
│   ├── SearchBar.tsx         JQL input + presets
│   └── IssueCard.tsx         issue card with build/open buttons
└── styles.css                Tailwind + VS Code CSS variable bindings
```

## How it talks to Claude Code

The extension never calls the Anthropic API. When the user clicks **Build with Claude**, the extension fires:

```
vscode://anthropic.claude-code/open?prompt=/feature%20AX-966
```

VS Code routes this to the installed Claude Code extension, which opens a new tab with the prompt prefilled. The user hits Send (or it auto-sends — depends on the Claude Code version), and Claude executes against the dev's logged-in subscription.

This sidesteps the Agent SDK's API-key billing requirement entirely. The trade-off: there's no programmatic feedback loop — the extension can't know when the build finishes or what Claude said. Progress is observed by inspecting `.claude-feature-context/` in the workspace, which the skill writes to disk.
