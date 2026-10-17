import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// Third-party code is bundled into public/vendor/ by scripts/build-vendor.mjs
// (ADR-0003); the page must not load code from any other origin.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));
const vercel = JSON.parse(read('vercel.json'));
const importMapBody = html.match(/<script type="importmap">([^<]+)<\/script>/)?.[1];
const importMap = JSON.parse(importMapBody ?? '{}');
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
const appSources = readdirSync(new URL('../public/js/', import.meta.url))
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, source: read(`public/js/${file}`) }));

test('the page has no external scripts and maps every bare import to a hashed /vendor/ module', () => {
  assert.doesNotMatch(html, /<script[^>]+src="(https?:)?\/\//, 'external <script src>');
  assert.ok(importMapBody, 'import map missing');
  assert.deepEqual(Object.keys(importMap), ['imports'], 'only "imports": same-origin files need no SRI');
  for (const [specifier, url] of Object.entries(importMap.imports)) {
    assert.match(url, /^\/vendor\/[\w-]+-[A-Z0-9]{8}\.js$/, `${specifier} must point to a content-hashed /vendor/ file`);
  }
});

test('every bare specifier the app imports is in the import map', () => {
  const specifiers = new Set();
  for (const { source: withComments } of appSources) {
    const source = withComments.replace(/\/\*[\s\S]*?\*\//g, ''); // JSDoc import() types are not runtime imports
    for (const [, spec] of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"./][^'"]*)['"]/g)) specifiers.add(spec);
  }
  assert.ok(specifiers.size > 0);
  for (const spec of specifiers) assert.ok(importMap.imports[spec], `${spec} is not mapped`);
});

test('MediaPipe and the GLTFLoader are only imported on demand', () => {
  for (const { file, source } of appSources) {
    assert.doesNotMatch(source, /\bfrom\s*['"](vendor\/hand-landmarker|three\/addons\/[^'"]+)['"]/, file);
  }
});

test('nothing in the deployed sources points to a CDN or to the legacy MediaPipe Hands', () => {
  const files = [{ file: 'index.html', source: html }, ...appSources, { file: 'css/style.css', source: read('public/css/style.css') }];
  for (const { file, source } of files) {
    assert.doesNotMatch(source, /cdn\.jsdelivr\.net|unpkg\.com|cdnjs|@mediapipe\/hands\b|window\.Hands\b|HAND_CONNECTIONS\s*\?\?/, file);
  }
});

test('the CSP only allows this origin, the import map by hash and WASM compilation', () => {
  const hash = `'sha256-${createHash('sha256').update(importMapBody).digest('base64')}'`;
  assert.deepEqual(directives['script-src'], ["'self'", hash, "'wasm-unsafe-eval'"]);
  assert.deepEqual(directives['connect-src'], ["'self'", 'blob:'], 'blob: is for textures embedded in .glb files');
  assert.deepEqual(directives['default-src'], ["'self'"]);
  assert.doesNotMatch(csp, /https?:|unsafe-inline|'unsafe-eval'|\*/);
});

test('/vendor/ is served as immutable (every file name there is versioned or content-hashed)', () => {
  const rule = vercel.headers.find((h) => h.source === '/vendor/(.*)');
  assert.ok(rule, 'no /vendor/ header rule');
  assert.deepEqual(rule.headers, [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
});

test('vendored libraries are exact-pinned and @types/three tracks the runtime version', () => {
  const exact = /^\d+\.\d+\.\d+$/;
  assert.match(pkg.dependencies.three, exact);
  assert.match(pkg.dependencies['@mediapipe/tasks-vision'], exact);
  assert.match(pkg.devDependencies.esbuild, exact);
  const minor = (v) => v.split('.').slice(0, 2).join('.');
  assert.equal(minor(pkg.devDependencies['@types/three']), minor(pkg.dependencies.three));
  assert.match(pkg.scripts.build, /build-vendor\.mjs/);
});

test('a built public/vendor/ has every file the import map names', { skip: !existsSync(new URL('../public/vendor/', import.meta.url)) && 'run npm run build first' }, () => {
  for (const url of Object.values(importMap.imports)) {
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `${url} missing: run npm run build`);
  }
});
