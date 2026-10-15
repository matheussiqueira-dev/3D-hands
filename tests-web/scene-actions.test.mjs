import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionForGesture, actionForKey, runAction } from '../public/js/scene-actions.js';
import { cameraView } from '../public/js/camera-state.js';

/** Minimal stand-in for Scene3D that records calls. */
function fakeScene() {
  const calls = [];
  let shape = 'cube';
  let colorIndex = 0;
  return {
    calls,
    translate: (d) => calls.push(['translate', d]),
    setAutoRotate: (v) => calls.push(['autoRotate', v]),
    zoom: (d) => calls.push(['zoom', d]),
    rotate: (d) => calls.push(['rotate', d]),
    reset: () => calls.push(['reset']),
    nextShape: () => { shape = 'sphere'; calls.push(['nextShape']); },
    nextColor: () => { colorIndex = 1; calls.push(['nextColor']); },
    getPose: () => ({ shape, colorIndex, modelName: null, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }),
  };
}

test('keys map to the documented actions, ignoring case', () => {
  assert.deepEqual(actionForKey('ArrowRight'), { type: 'move', delta: { x: 0.05, y: 0 } });
  assert.deepEqual(actionForKey('N'), { type: 'nextShape' });
  assert.deepEqual(actionForKey('c'), { type: 'nextColor' });
  assert.deepEqual(actionForKey('='), { type: 'zoom', amount: 1 });
  assert.deepEqual(actionForKey(' '), { type: 'autoRotate' });
  assert.equal(actionForKey('x'), null);
});

test('gestures map to scene actions', () => {
  assert.deepEqual(actionForGesture({ name: 'open_palm', active: true, data: { delta: { x: 0.1, y: 0 } } }), { type: 'move', delta: { x: 0.1, y: 0 }, stopAutoRotate: true });
  assert.deepEqual(actionForGesture({ name: 'pinch', active: true, data: { distance: 0.02 } }), { type: 'zoom', amount: -1 });
  assert.deepEqual(actionForGesture({ name: 'pinch', active: true, data: { distance: 0.04 } }), { type: 'zoom', amount: 1 });
  assert.deepEqual(actionForGesture({ name: 'fist', active: true, data: null }), { type: 'reset' });
  assert.deepEqual(actionForGesture({ name: 'v_sign', active: true, data: null }), { type: 'nextShape' });
  assert.deepEqual(actionForGesture({ name: 'three_fingers', active: true, data: null }), { type: 'nextColor' });
  assert.equal(actionForGesture({ name: 'dual_hands', active: true, data: { scaleDelta: 0 } }), null);
  assert.equal(actionForGesture({ name: 'fist', active: false, data: null }), null);
});

test('discrete actions report a history detail and a screen-reader announcement', () => {
  const scene = fakeScene();
  assert.deepEqual(runAction({ type: 'nextShape' }, scene), { detail: 'forma: Esfera', announcement: 'Forma: Esfera.' });
  assert.deepEqual(runAction({ type: 'nextColor' }, scene), { detail: 'cor: Pêssego', announcement: 'Cor: Pêssego.' });
  assert.deepEqual(runAction({ type: 'reset' }, scene), { detail: 'objeto redefinido', announcement: 'Objeto redefinido.' });
});

test('continuous actions change the scene without announcing', () => {
  const scene = fakeScene();
  assert.deepEqual(runAction({ type: 'move', delta: { x: 0.1, y: 0 }, stopAutoRotate: true }, scene), {});
  assert.deepEqual(runAction({ type: 'zoom', amount: 1 }, scene), {});
  assert.deepEqual(scene.calls, [['translate', { x: 0.1, y: 0 }], ['autoRotate', false], ['zoom', 1]]);
  assert.deepEqual(runAction({ type: 'zoom', amount: 1 }, null), {});
});

test('the camera view follows the state machine', () => {
  assert.deepEqual(cameraView('off', 0), {
    chip: 'Câmera: desligada', startHidden: false, startBusy: false, startLabel: 'Ativar câmera',
    stopHidden: true, placeholderHidden: false, placeholderText: 'Câmera desligada',
    hint: 'Os gestos acendem aqui quando a câmera estiver ativa.',
  });
  const loading = cameraView('loading', 0);
  assert.equal(loading.startBusy, true);
  assert.equal(loading.startLabel, 'Carregando modelo de mãos…');
  assert.equal(loading.placeholderText, 'Iniciando câmera…');
  const noHand = cameraView('active', 0);
  assert.equal(noHand.startHidden, true);
  assert.equal(noHand.stopHidden, false);
  assert.equal(noHand.hint, 'Mostre a mão para a câmera, com a palma voltada para a tela.');
  assert.equal(cameraView('active', 1).hint, '');
  assert.equal(cameraView('error', 0).chip, 'Câmera: erro');
});
