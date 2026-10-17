import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FPSCounter, LandmarkSmoother, withTimeout } from '../public/js/utils.js';
import { makeHand } from './hand-fixtures.mjs';

test('FPSCounter measures frames per second from real timestamps', () => {
  let t = 0;
  const fps = new FPSCounter(10, () => t);
  for (let i = 0; i < 10; i++) { fps.tick(); t += 1000 / 30; }
  assert.equal(fps.value, 30);
  fps.reset();
  assert.equal(fps.value, 0);
});

test('LandmarkSmoother damps frame-to-frame jitter', () => {
  const s = new LandmarkSmoother({ alpha: 0.5 });
  const still = makeHand({ index: true });
  s.smooth([{ landmarks: still, handedness: 'Right' }]);
  const jittered = makeHand({ index: true }, { offsetX: 0.02 });
  const [out] = s.smooth([{ landmarks: jittered, handedness: 'Right' }]);
  assert.ok(Math.abs(out.landmarks[0].x - (still[0].x + 0.01)) < 1e-9);
});

test('LandmarkSmoother keeps hands apart by handedness, even when MediaPipe swaps their order', () => {
  const s = new LandmarkSmoother({ alpha: 0.5 });
  const left = makeHand({}, { offsetX: -0.2 });
  const right = makeHand({}, { offsetX: 0.2 });
  s.smooth([{ landmarks: left, handedness: 'Left' }, { landmarks: right, handedness: 'Right' }]);
  const out = s.smooth([{ landmarks: right, handedness: 'Right' }, { landmarks: left, handedness: 'Left' }]);
  assert.equal(out[0].landmarks[0].x, right[0].x);
  assert.equal(out[1].landmarks[0].x, left[0].x);
});

test('LandmarkSmoother snaps to a hand that jumped instead of dragging it across the frame', () => {
  const s = new LandmarkSmoother({ alpha: 0.5, jumpThreshold: 0.15 });
  s.smooth([{ landmarks: makeHand({}), handedness: 'Right' }]);
  const far = makeHand({}, { offsetX: 0.3 });
  const [out] = s.smooth([{ landmarks: far, handedness: 'Right' }]);
  assert.equal(out.landmarks[0].x, far[0].x);
});

test('LandmarkSmoother forgets a hand that left the frame', () => {
  const s = new LandmarkSmoother({ alpha: 0.5 });
  s.smooth([{ landmarks: makeHand({}), handedness: 'Right' }]);
  s.smooth([]);
  const moved = makeHand({}, { offsetX: 0.05 });
  const [out] = s.smooth([{ landmarks: moved, handedness: 'Right' }]);
  assert.equal(out.landmarks[0].x, moved[0].x);
});

test('withTimeout resolves in time and rejects with the provided error when late', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, () => new Error('late')), 7);
  const never = new Promise(() => {});
  await assert.rejects(withTimeout(never, 10, () => new Error('late')), /late/);
});
