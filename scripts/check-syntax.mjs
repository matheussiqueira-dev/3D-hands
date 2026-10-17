// Runs `node --check` on every browser module (they cannot be imported in Node
// because they touch `document` and `window` at load time).
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dirs = ['public/js', 'scripts'];
let failed = false;
for (const dir of dirs) {
  for (const name of readdirSync(dir)) {
    if (!/\.m?js$/.test(name)) continue;
    const file = join(dir, name);
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    } catch {
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
