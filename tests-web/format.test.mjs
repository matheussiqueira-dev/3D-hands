import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHistoryEntry, formatPose, gestureLabel } from '../public/js/format.js';

test('the pose readout uses PT-BR numbers, degrees and shape names', () => {
  const text = formatPose({
    shape: 'cone',
    position: { x: 0.3, y: -1.256, z: 0 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 4, z: 0 },
    scale: 1.05,
  });
  assert.deepEqual(text, {
    shape: 'Cone',
    position: 'x 0,30 · y -1,26',
    rotation: 'x 90° · y 315°',
    scale: '1,05×',
  });
});

test('rotation wraps past a full turn and scale keeps one decimal', () => {
  const text = formatPose({ shape: 'cube', position: { x: 0, y: 0 }, rotation: { x: 2 * Math.PI + 0.01, y: 0 }, scale: 1 });
  assert.equal(text.rotation, 'x 1° · y 0°');
  assert.equal(text.scale, '1,0×');
  assert.equal(text.shape, 'Cubo');
});

test('history entries read as PT-BR sentences', () => {
  assert.equal(formatHistoryEntry({ gesture: 'v_sign', detail: 'forma: Esfera', time: '14:03:12' }), 'Sinal de V · forma: Esfera · 14:03:12');
  assert.equal(formatHistoryEntry({ gesture: 'open_palm', time: '14:03:13' }), 'Mão aberta · 14:03:13');
  assert.equal(gestureLabel('unknown_gesture'), 'unknown_gesture');
});
