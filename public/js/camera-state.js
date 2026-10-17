/**
 * Camera state machine view: maps the state (off → loading → active | error)
 * and the hand count to what the interface shows. Pure, so every state is
 * unit-tested; app.js only copies the result into the DOM.
 * @module camera-state
 */

/** @typedef {'off' | 'loading' | 'active' | 'error'} CameraState */

/**
 * @typedef {object} CameraView
 * @property {string} chip
 * @property {boolean} startHidden
 * @property {boolean} startBusy
 * @property {string} startLabel
 * @property {boolean} stopHidden
 * @property {boolean} placeholderHidden
 * @property {string} placeholderText
 * @property {string} hint empty string hides the hint
 */

/** @type {Readonly<Record<CameraState, string>>} */
export const CAMERA_LABELS = Object.freeze({
  off: 'Câmera: desligada',
  loading: 'Câmera: iniciando',
  active: 'Câmera: ativa',
  error: 'Câmera: erro',
});

const HINTS = Object.freeze({
  idle: 'Os gestos acendem aqui quando a câmera estiver ativa.',
  loading: 'Carregando modelo de mãos…',
  noHand: 'Mostre a mão para a câmera, com a palma voltada para a tela.',
});

/**
 * @param {CameraState} state
 * @param {number} handCount hands in the latest frame
 * @returns {CameraView}
 */
export function cameraView(state, handCount) {
  const loading = state === 'loading';
  const active = state === 'active';
  /** @type {string} */
  let hint = HINTS.idle;
  if (loading) hint = HINTS.loading;
  if (active) hint = handCount === 0 ? HINTS.noHand : '';
  return {
    chip: CAMERA_LABELS[state],
    startHidden: active,
    startBusy: loading,
    startLabel: loading ? 'Carregando modelo de mãos…' : 'Ativar câmera',
    stopHidden: !active,
    placeholderHidden: active,
    placeholderText: loading ? 'Iniciando câmera…' : 'Câmera desligada',
    hint,
  };
}
