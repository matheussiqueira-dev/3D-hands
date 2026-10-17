import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_ERROR_MESSAGES, cameraErrorMessage, formatHistoryEntry, formatPose, gestureLabel } from '../public/js/format.js';

test('the pose readout uses PT-BR numbers, degrees and shape names', () => {
  const text = formatPose({
    shape: 'cone',
    colorIndex: 2,
    position: { x: 0.3, y: -1.256, z: 0 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 4, z: 0 },
    scale: 1.05,
  });
  assert.deepEqual(text, {
    shape: 'Cone',
    color: 'Índigo',
    position: 'x 0,30 · y -1,26',
    rotation: 'x 90° · y 315°',
    scale: '1,05×',
  });
});

test('a loaded model shows its file name and original colours', () => {
  const text = formatPose({ shape: 'custom', modelName: 'cadeira.glb', colorIndex: null, position: { x: 0, y: 0 }, rotation: { x: 0, y: 0 }, scale: 1 });
  assert.equal(text.shape, 'Modelo: cadeira.glb');
  assert.equal(text.color, 'Originais do modelo');
});

test('rotation wraps past a full turn and scale keeps one decimal', () => {
  const text = formatPose({ shape: 'cube', colorIndex: 0, position: { x: 0, y: 0 }, rotation: { x: 2 * Math.PI + 0.01, y: 0 }, scale: 1 });
  assert.equal(text.rotation, 'x 1° · y 0°');
  assert.equal(text.scale, '1,0×');
  assert.equal(text.shape, 'Cubo');
});

test('history entries read as PT-BR sentences', () => {
  assert.equal(formatHistoryEntry({ gesture: 'v_sign', detail: 'forma: Esfera', time: '14:03:12' }), 'Sinal de V · forma: Esfera · 14:03:12');
  assert.equal(formatHistoryEntry({ gesture: 'open_palm', time: '14:03:13' }), 'Mão aberta · 14:03:13');
  assert.equal(gestureLabel('unknown_gesture'), 'unknown_gesture');
});

test('every camera error code has a PT-BR message and unknown codes fall back', () => {
  for (const code of ['denied', 'not-found', 'in-use', 'unsupported', 'ended', 'model', 'unknown']) {
    assert.equal(cameraErrorMessage(code), CAMERA_ERROR_MESSAGES[code], code);
  }
  assert.match(cameraErrorMessage('ended'), /parou de enviar imagem/);
  assert.equal(cameraErrorMessage('outro'), CAMERA_ERROR_MESSAGES.unknown);
  assert.equal(cameraErrorMessage(undefined), CAMERA_ERROR_MESSAGES.unknown);
});
