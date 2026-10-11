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
