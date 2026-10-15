/**
 * Pure PT-BR formatting helpers shared by the UI (no DOM access).
 * @module format
 */

import { GESTURE_CATALOG, OBJECT_COLORS } from './config.js';

const seconds = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** @param {number} ms @returns {string} e.g. "segure 0,8 s" */
export function formatHold(ms) {
  return `segure ${seconds.format(ms / 1000)} s`;
}

/**
 * One guide line: "Punho fechado · segure 2 s · redefine o objeto".
 * @param {{ label: string, holdMs: number, action: string }} entry
 */
export function formatGestureLine(entry) {
  return [entry.label, entry.holdMs > 0 ? formatHold(entry.holdMs) : null, entry.action]
    .filter(Boolean)
    .join(' · ');
}

const KEYBOARD_HINT = 'Use as setas, N, C, R e +/− para controlar o objeto.';

/** User-facing PT-BR message for a CameraError code (see hand-tracker.js). @type {Readonly<Record<string, string>>} */
export const CAMERA_ERROR_MESSAGES = Object.freeze({
  denied: 'A câmera foi bloqueada. Libere o acesso no cadeado da barra de endereço e clique em Tentar novamente.',
  'not-found': `Nenhuma câmera encontrada. ${KEYBOARD_HINT}`,
  'in-use': 'A câmera está sendo usada por outro aplicativo. Feche esse aplicativo e clique em Tentar novamente.',
  unsupported: `Este navegador não permite usar a câmera nesta página. ${KEYBOARD_HINT}`,
  model: 'Não foi possível carregar o modelo de mãos. Verifique a conexão e clique em Tentar novamente.',
  unknown: 'Não foi possível iniciar a câmera. Clique em Tentar novamente.',
});

/** @param {string | undefined} code */
export function cameraErrorMessage(code) {
  return (code && CAMERA_ERROR_MESSAGES[code]) || CAMERA_ERROR_MESSAGES.unknown;
}

/** @type {Readonly<Record<string, string>>} */
const GESTURE_LABELS = Object.freeze(Object.fromEntries(GESTURE_CATALOG.map((g) => [g.id, g.label])));

/** @param {string} id @returns {string} PT-BR gesture name */
export function gestureLabel(id) {
  return GESTURE_LABELS[id] ?? id;
}

/**
 * One history line: "Sinal de V · forma: Esfera · 14:03:12".
 * @param {{ gesture: string, detail?: string, time: string }} entry
 */
export function formatHistoryEntry(entry) {
  return [gestureLabel(entry.gesture), entry.detail, entry.time].filter(Boolean).join(' · ');
}

/** @type {Readonly<Record<string, string>>} */
export const SHAPE_LABELS = Object.freeze({
  cube: 'Cubo', sphere: 'Esfera', cone: 'Cone', torus: 'Toro', dodecahedron: 'Dodecaedro',
});

/**
 * PT-BR name of the current shape; a loaded model shows its file name.
 * @param {string} shape @param {string | null} [modelName] @returns {string}
 */
export function shapeLabel(shape, modelName = null) {
  if (shape === 'custom') return `Modelo: ${modelName ?? 'próprio'}`;
  return SHAPE_LABELS[shape] ?? shape;
}

const coord = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const degrees = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const factor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Radians to whole degrees in [0, 360). @param {number} rad */
function toDegrees(rad) {
  const deg = Math.round((rad * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/**
 * Text version of the scene pose (the canvas's textual alternative).
 * @param {{ shape: string, modelName?: string | null, colorIndex: number | null, position: {x:number,y:number}, rotation: {x:number,y:number}, scale: number }} pose
 */
export function formatPose(pose) {
  return {
    shape: shapeLabel(pose.shape, pose.modelName),
    color: pose.colorIndex === null ? 'Originais do modelo' : OBJECT_COLORS[pose.colorIndex]?.label ?? '',
    position: `x ${coord.format(pose.position.x)} · y ${coord.format(pose.position.y)}`,
    rotation: `x ${degrees.format(toDegrees(pose.rotation.x))}° · y ${degrees.format(toDegrees(pose.rotation.y))}°`,
    scale: `${factor.format(pose.scale)}×`,
  };
}
