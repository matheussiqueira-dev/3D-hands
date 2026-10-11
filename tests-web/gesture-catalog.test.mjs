import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GESTURE_CATALOG, GESTURE_CONFIG } from '../public/js/config.js';
import { GESTURE_NAMES } from '../public/js/gesture-recognizer.js';
import { formatGestureLine, formatHold } from '../public/js/format.js';

test('the guide lists exactly the gestures the recognizer emits', () => {
  assert.deepEqual(GESTURE_CATALOG.map((g) => g.id).sort(), [...GESTURE_NAMES].sort());
});

test('hold times in the guide come from the recognizer configuration', () => {
  const hold = Object.fromEntries(GESTURE_CATALOG.map((g) => [g.id, g.holdMs]));
  assert.equal(hold.fist, GESTURE_CONFIG.FIST_HOLD_MS);
  assert.equal(hold.v_sign, GESTURE_CONFIG.V_SIGN_HOLD_MS);
  assert.equal(hold.three_fingers, GESTURE_CONFIG.THREE_FINGER_HOLD_MS);
  for (const id of ['open_palm', 'pinch', 'two_fingers', 'dual_hands']) assert.equal(hold[id], 0);
});

test('guide lines are formatted in PT-BR', () => {
  assert.equal(formatHold(800), 'segure 0,8 s');
  assert.equal(formatHold(2000), 'segure 2 s');
  const fist = GESTURE_CATALOG.find((g) => g.id === 'fist');
  assert.equal(formatGestureLine(fist), 'Punho fechado · segure 2 s · redefine o objeto');
  const palm = GESTURE_CATALOG.find((g) => g.id === 'open_palm');
  assert.equal(formatGestureLine(palm), 'Mão aberta · move o objeto na horizontal e na vertical');
});
