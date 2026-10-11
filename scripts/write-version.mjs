// Build step: writes public/version.json for the footer meta line
// ("3D Hands · v{version} · {short commit}"). On Vercel the commit comes from
// VERCEL_GIT_COMMIT_SHA; elsewhere it is omitted.
import { readFileSync, writeFileSync } from 'node:fs';

try {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  const info = { version: pkg.version, commit: /^[0-9a-f]{7,40}$/.test(sha) ? sha.slice(0, 7) : null };
  writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(info) + '\n');
  console.log('version.json', info);
} catch (err) {
  // Fail the build loudly: an unreadable package.json or unwritable public/ is a real problem.
  console.error('[write-version] failed:', err.message);
  process.exit(1);
}
