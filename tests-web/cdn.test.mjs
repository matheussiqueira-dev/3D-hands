import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEDIAPIPE_HANDS_BASE_URL } from '../public/js/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const cdnScripts = [...html.matchAll(/<script src="(https:[^"]+)"([^>]*)>/g)];

test('every CDN script is pinned to an exact version and has SRI', () => {
  assert.ok(cdnScripts.length > 0);
  for (const [, url, attrs] of cdnScripts) {
    assert.match(url, /@\d+\.\d+\.\d+\//, `unpinned: ${url}`);
    assert.match(attrs, /integrity="sha384-[A-Za-z0-9+/=]+"/, `no SRI: ${url}`);
    assert.match(attrs, /crossorigin="anonymous"/, `no crossorigin: ${url}`);
  }
});

test('the MediaPipe asset base matches the hands.js version in the page', () => {
  const hands = cdnScripts.map(([, url]) => url).find((url) => url.includes('@mediapipe/hands@'));
  assert.ok(hands);
  assert.equal(hands.replace(/hands\.js$/, ''), MEDIAPIPE_HANDS_BASE_URL);
});
