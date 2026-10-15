import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEDIAPIPE_HANDS_BASE_URL, MEDIAPIPE_HANDS_SCRIPT } from '../public/js/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const cdnScripts = [...html.matchAll(/<script src="(https:[^"]+)"([^>]*)>/g)];

test('every CDN script in the page is pinned to an exact version and has SRI', () => {
  for (const [, url, attrs] of cdnScripts) {
    assert.match(url, /@\d+\.\d+\.\d+\//, `unpinned: ${url}`);
    assert.match(attrs, /integrity="sha384-[A-Za-z0-9+/=]+"/, `no SRI: ${url}`);
    assert.match(attrs, /crossorigin="anonymous"/, `no crossorigin: ${url}`);
  }
});

test('MediaPipe Hands is not loaded by the page itself (only after the camera starts)', () => {
  assert.doesNotMatch(html, /@mediapipe\/hands/);
});

test('the on-demand MediaPipe script is pinned, has SRI and matches the asset base', () => {
  assert.match(MEDIAPIPE_HANDS_BASE_URL, /@mediapipe\/hands@\d+\.\d+\.\d+\/$/);
  assert.equal(MEDIAPIPE_HANDS_SCRIPT.src, `${MEDIAPIPE_HANDS_BASE_URL}hands.js`);
  assert.match(MEDIAPIPE_HANDS_SCRIPT.integrity, /^sha384-[A-Za-z0-9+/=]{64}$/);
});

test('Three.js loads as ES modules through a pinned import map with SRI', () => {
  const body = html.match(/<script type="importmap">([^<]+)<\/script>/)?.[1];
  assert.ok(body, 'import map missing');
  const map = JSON.parse(body);
  for (const url of Object.values(map.imports)) assert.match(url, /three@\d+\.\d+\.\d+\//);
  assert.ok(map.integrity[map.imports.three], 'three.module.js has no SRI');
  for (const hash of Object.values(map.integrity)) assert.match(hash, /^sha384-[A-Za-z0-9+/=]{64}$/);
  assert.doesNotMatch(html, /three\.min\.js/);
});

test('the CSP allows the inline import map by hash, never with unsafe-inline', async () => {
  const { createHash } = await import('node:crypto');
  const body = html.match(/<script type="importmap">([^<]+)<\/script>/)[1];
  const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  assert.ok(csp.includes(hash), `CSP lacks ${hash}`);
  assert.doesNotMatch(csp, /unsafe-inline|'unsafe-eval'/);
});
