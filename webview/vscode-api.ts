// Typed wrapper around the VS Code webview API.
import type { WebviewToHost, HostToWebview } from '../src/messages';

interface VsCodeApi {
  postMessage(msg: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;
export function vscode(): VsCodeApi {
  if (!api) api = acquireVsCodeApi();
  return api;
}

export type { HostToWebview, WebviewToHost };
