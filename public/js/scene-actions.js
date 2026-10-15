/**
 * Scene actions: one vocabulary for keyboard, gestures and buttons.
 * Pure mapping + execution against a scene-like object, so it is unit-tested
 * without WebGL.
 * @module scene-actions
 */

import { OBJECT_COLORS } from './config.js';
import { SHAPE_LABELS } from './format.js';

/**
 * @typedef {{ type: 'move', delta: { x: number, y: number }, stopAutoRotate?: boolean }
 *   | { type: 'zoom', amount: number }
 *   | { type: 'rotate', amount: number }
 *   | { type: 'reset' } | { type: 'nextShape' } | { type: 'nextColor' } | { type: 'autoRotate' }} SceneAction
 */

/**
 * @typedef {object} SceneLike
 * @property {(delta: { x: number, y: number }) => void} translate
 * @property {(value: boolean) => void} setAutoRotate
 * @property {(amount: number) => void} zoom
 * @property {(amount: number) => void} rotate
 * @property {() => void} reset
 * @property {() => void} nextShape
 * @property {() => void} nextColor
 * @property {() => { shape: string, colorIndex: number }} getPose
 */

/** @typedef {{ detail?: string, announcement?: string }} ActionOutcome */

const STEP = 0.05;

/** @type {Readonly<Record<string, SceneAction>>} */
const KEY_ACTIONS = Object.freeze({
  ArrowUp: { type: 'move', delta: { x: 0, y: -STEP } },
  ArrowDown: { type: 'move', delta: { x: 0, y: STEP } },
  ArrowLeft: { type: 'move', delta: { x: -STEP, y: 0 } },
  ArrowRight: { type: 'move', delta: { x: STEP, y: 0 } },
  r: { type: 'reset' },
  n: { type: 'nextShape' },
  c: { type: 'nextColor' },
  '+': { type: 'zoom', amount: 1 },
  '=': { type: 'zoom', amount: 1 },
  '-': { type: 'zoom', amount: -1 },
  ' ': { type: 'autoRotate' },
});

/** Pinch tips closer than this shrink the object; a slightly open pinch grows it. */
const PINCH_SHRINK_BELOW = 0.03;
const ROTATE_GAIN = 0.05;
const DUAL_HAND_ZOOM_GAIN = 10;

/** @param {string} key KeyboardEvent.key @returns {SceneAction | null} */
export function actionForKey(key) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  return KEY_ACTIONS[normalized] ?? null;
}

/**
 * @param {{ name: string, active: boolean, data: any }} gesture result from GestureRecognizer
 * @returns {SceneAction | null}
 */
export function actionForGesture(gesture) {
  if (!gesture?.active) return null;
  switch (gesture.name) {
    case 'open_palm': return { type: 'move', delta: gesture.data.delta, stopAutoRotate: true };
    case 'pinch': return { type: 'zoom', amount: gesture.data.distance < PINCH_SHRINK_BELOW ? -1 : 1 };
    case 'two_fingers': return { type: 'rotate', amount: gesture.data.angle * ROTATE_GAIN };
    case 'fist': return { type: 'reset' };
    case 'v_sign': return { type: 'nextShape' };
    case 'three_fingers': return { type: 'nextColor' };
    case 'dual_hands':
      return gesture.data?.scaleDelta ? { type: 'zoom', amount: gesture.data.scaleDelta * DUAL_HAND_ZOOM_GAIN } : null;
    default: return null;
  }
}

/**
 * Applies an action. Discrete changes return a history detail and an
 * announcement; continuous motion returns nothing (it would flood screen readers).
 * @param {SceneAction} action
 * @param {SceneLike | null} scene
 * @returns {ActionOutcome}
 */
export function runAction(action, scene) {
  if (!scene) return {};
  switch (action.type) {
    case 'move':
      scene.translate(action.delta);
      if (action.stopAutoRotate) scene.setAutoRotate(false);
      return {};
    case 'zoom': scene.zoom(action.amount); return {};
    case 'rotate': scene.rotate(action.amount); return {};
    case 'autoRotate': scene.setAutoRotate(true); return {};
    case 'reset':
      scene.reset();
      return { detail: 'objeto redefinido', announcement: 'Objeto redefinido.' };
    case 'nextShape': {
      scene.nextShape();
      const label = SHAPE_LABELS[scene.getPose().shape] ?? scene.getPose().shape;
      return { detail: `forma: ${label}`, announcement: `Forma: ${label}.` };
    }
    case 'nextColor': {
      scene.nextColor();
      const label = OBJECT_COLORS[scene.getPose().colorIndex]?.label ?? '';
      return { detail: `cor: ${label}`, announcement: `Cor: ${label}.` };
    }
    default: return {};
  }
}
