// One-shot release: bump version, build, package, commit, tag, push, and
// (if `gh` CLI is available) create the GitHub release with the .vsix attached.
//
// Usage:
//   node scripts/release.mjs <patch|minor|major>

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const bump = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/release.mjs <patch|minor|major>');
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// 1. Bump version (no tag yet — we tag after the build succeeds).
run(`npm version ${bump} --no-git-tag-version`);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;
console.log(`\nBumped to v${version}\n`);

// 2. Build + package (produces jira-portal-<version>.vsix).
run('npm run package');

// 3. Commit + tag + push.
run('git add package.json package-lock.json');
run(`git commit -m "release: v${version}"`);
run(`git tag v${version}`);
run('git push');
run('git push --tags');

// 4. Create GitHub release with the .vsix attached, if gh CLI is installed.
const vsix = `jira-portal-${version}.vsix`;
if (tryRun('gh --version')) {
  run(
    `gh release create v${version} ${vsix} --title "v${version}" --notes "Release v${version}"`
  );
  console.log(`\nReleased v${version}.`);
} else {
  console.log(`\nTag v${version} pushed. Now upload ${vsix} to:`);
  console.log(
    `  https://github.com/rmeikle-dev/jiraportal/releases/new?tag=v${version}`
  );
  console.log('\nOr install gh CLI to automate this step (https://cli.github.com).');
}
