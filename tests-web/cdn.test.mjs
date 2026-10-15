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
