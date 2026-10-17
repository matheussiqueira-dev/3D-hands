import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));

test('ms-tokens.css is the canonical v1.0 file, byte for byte', () => {
  const sha = createHash('sha256').update(read('public/ms-tokens.css')).digest('hex');
  assert.equal(sha, '4ee1fcd1e10a7592079aebe6ba675cf46d971ae3fdce64b54efadedef1a4fe99');
});

test('app CSS uses tokens instead of literal colours', () => {
  const css = read('public/css/style.css').toString('utf8');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('fonts are self-hosted, with no third-party font CSS', () => {
  const html = read('public/index.html').toString('utf8');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(html, /\/fonts\/ibm-plex-sans-latin-wght-normal\.v5-3-0\.woff2/);
  assert.ok(read('public/fonts/ibm-plex-sans-latin-wght-normal.v5-3-0.woff2').length === 45712);
});

test('vercel.json caches fonts as immutable and sets no COEP', () => {
  const vercel = JSON.parse(read('vercel.json').toString('utf8'));
  const fonts = vercel.headers.find((h) => h.source === '/fonts/(.*)');
  assert.match(fonts.headers[0].value, /immutable/);
  const keys = vercel.headers.flatMap((h) => h.headers.map((x) => x.key));
  assert.ok(!keys.includes('Cross-Origin-Embedder-Policy'));
  assert.equal(vercel.builds, undefined);
  assert.equal(vercel.routes, undefined);
});
