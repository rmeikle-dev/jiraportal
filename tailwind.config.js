/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./webview/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Map to VS Code CSS variables so the webview themes with the editor.
        bg: 'var(--vscode-editor-background)',
        fg: 'var(--vscode-editor-foreground)',
        muted: 'var(--vscode-descriptionForeground)',
        border: 'var(--vscode-panel-border)',
        accent: 'var(--vscode-button-background)',
        'accent-fg': 'var(--vscode-button-foreground)',
        'accent-hover': 'var(--vscode-button-hoverBackground)',
        input: 'var(--vscode-input-background)',
        'input-fg': 'var(--vscode-input-foreground)',
        'input-border': 'var(--vscode-input-border)',
        card: 'var(--vscode-editorWidget-background)',
        'card-hover': 'var(--vscode-list-hoverBackground)',
        link: 'var(--vscode-textLink-foreground)',
        warning: 'var(--vscode-editorWarning-foreground)',
        error: 'var(--vscode-errorForeground)',
        success: 'var(--vscode-testing-iconPassed)'
      },
      fontFamily: {
        sans: ['var(--vscode-font-family)'],
        mono: ['var(--vscode-editor-font-family)']
      }
    }
  },
  plugins: []
};
