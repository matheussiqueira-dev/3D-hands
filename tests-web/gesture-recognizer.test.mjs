import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureRecognizer } from '../public/js/gesture-recognizer.js';
import { POSES, makeHand } from './hand-fixtures.mjs';

const names = (results) => results.map((r) => r.name).sort();

test('invalid input yields no gestures', () => {
  const r = new GestureRecognizer();
  assert.deepEqual(r.recognize(null), []);
  assert.deepEqual(r.recognize([{ x: 0, y: 0 }]), []);
});

test('open palm is recognized and reports movement after the deadzone', () => {
  const r = new GestureRecognizer();
  const first = r.recognize(POSES.openPalm()).find((g) => g.name === 'open_palm');
  assert.deepEqual(first.data.delta, { x: 0, y: 0 });
  const moved = r.recognize(makeHand({ thumb: true, index: true, middle: true, ring: true, pinky: true }, { offsetX: 0.1 }));
  assert.ok(moved.find((g) => g.name === 'open_palm').data.delta.x > 0);
});

test('pinch is active when thumb and index tips touch', () => {
  const r = new GestureRecognizer();
  assert.equal(r.recognize(POSES.pinch()).find((g) => g.name === 'pinch').active, true);
  assert.equal(r.recognize(POSES.openPalm()).find((g) => g.name === 'pinch').active, false);
});

test('two fingers held together rotate and are not a V sign', () => {
  const r = new GestureRecognizer();
  const got = names(r.recognize(POSES.twoFingers()));
  assert.ok(got.includes('two_fingers'));
  assert.ok(!got.includes('v_sign'));
});

test('a V sign never triggers the rotate gesture', () => {
  const r = new GestureRecognizer();
  const got = names(r.recognize(POSES.vSign()));
  assert.ok(got.includes('v_sign'));
  assert.ok(!got.includes('two_fingers'));
});

test('three fingers never trigger the rotate gesture', () => {
  const r = new GestureRecognizer();
  const got = names(r.recognize(POSES.threeFingers()));
  assert.ok(got.includes('three_fingers'));
  assert.ok(!got.includes('two_fingers'));
});

test('two hands produce the dual-hand scale gesture', () => {
  const r = new GestureRecognizer();
  r.recognize(POSES.openPalm(), makeHand({ thumb: true, index: true, middle: true, ring: true, pinky: true }, { offsetX: 0.3 }));
  const spread = r.recognize(POSES.openPalm(), makeHand({ thumb: true, index: true, middle: true, ring: true, pinky: true }, { offsetX: 0.4 }));
  const dual = spread.find((g) => g.name === 'dual_hands');
  assert.ok(dual.data.scaleDelta > 0);
  assert.equal(r.getPrimaryGesture(spread).name, 'dual_hands');
});

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('no gesture reports a confidence value', () => {
  const r = new GestureRecognizer();
  for (const pose of Object.values(POSES)) {
    for (const g of r.recognize(pose())) assert.equal('confidence' in g, false, g.name);
  }
});

test('hold progress follows the real elapsed time', () => {
  const clock = fakeClock();
  const r = new GestureRecognizer({}, { now: clock.now });
  const at = () => r.recognize(POSES.fist()).find((g) => g.name === 'fist');
  assert.equal(at().progress, 0);
  clock.advance(500);
  assert.equal(at().progress, 0.25);
  clock.advance(500);
  const half = at();
  assert.equal(half.progress, 0.5);
  assert.equal(half.active, false);
  clock.advance(1000);
  const done = at();
  assert.equal(done.progress, 1);
  assert.equal(done.active, true);
});

test('hold timers use the configured durations', () => {
  const clock = fakeClock();
  const r = new GestureRecognizer({}, { now: clock.now });
  r.recognize(POSES.threeFingers());
  clock.advance(400);
  assert.equal(r.recognize(POSES.threeFingers()).find((g) => g.name === 'three_fingers').progress, 0.5);
  const v = new GestureRecognizer({}, { now: clock.now });
  v.recognize(POSES.vSign());
  clock.advance(1000);
  assert.equal(v.recognize(POSES.vSign()).find((g) => g.name === 'v_sign').active, true);
});

test('releasing the pose restarts the hold', () => {
  const clock = fakeClock();
  const r = new GestureRecognizer({}, { now: clock.now });
  r.recognize(POSES.fist());
  clock.advance(1500);
  r.recognize(POSES.openPalm());
  clock.advance(100);
  assert.equal(r.recognize(POSES.fist()).find((g) => g.name === 'fist').progress, 0);
});

test('a hold gesture fires once per hold, not on every frame', () => {
  const clock = fakeClock();
  const r = new GestureRecognizer({}, { now: clock.now });
  const fist = () => r.recognize(POSES.fist()).find((g) => g.name === 'fist');
  fist();
  clock.advance(2000);
  assert.equal(fist().active, true);
  clock.advance(16);
  const after = fist();
  assert.equal(after.active, false);
  assert.equal(after.progress, 1);
  clock.advance(5000);
  assert.equal(fist().active, false);
  r.recognize(POSES.openPalm());
  fist();
  clock.advance(2000);
  assert.equal(fist().active, true);
});
