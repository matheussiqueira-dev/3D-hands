/**
 * Application Configuration — Central Constants Module
 * Single source of truth for all tunable parameters.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 * @module  config
 */

export const GESTURE_CONFIG = Object.freeze({
  PINCH_THRESHOLD:         0.05,
  FINGER_EXTENDED_RATIO:   1.05,
  THUMB_EXTENDED_X_DELTA:  0.04,
  // Index-to-middle tip gap divided by palm length (wrist to middle knuckle):
  // below it the two fingers are "together" (rotate), at or above it a V sign.
  V_SIGN_MIN_SPREAD_RATIO: 0.35,
  FIST_HOLD_MS:         2000,
  V_SIGN_HOLD_MS:       1000,
  THREE_FINGER_HOLD_MS:  800,
  MIN_OPEN_FINGERS:    4,
  MIN_THREE_FINGERS:   3,
  TRANSLATION_DEADZONE: 0.018,
  SCALE_DEADZONE:       0.008,
});

/**
 * Every gesture the browser recognizer emits, in display order. The on-screen
 * guide and the README table are checked against this list by the tests.
 * `holdMs` is 0 for continuous gestures.
 */
/**
 * @typedef {object} GestureCatalogEntry
 * @property {import('./gesture-recognizer.js').GestureName} id
 * @property {string} icon Lucide icon name (see icons.js)
 * @property {string} label PT-BR name shown in the panel
 * @property {number} holdMs 0 for continuous gestures
 * @property {string} action PT-BR description of the effect
 */

/** @type {readonly GestureCatalogEntry[]} */
export const GESTURE_CATALOG = Object.freeze(/** @type {GestureCatalogEntry[]} */ ([
  { id: 'open_palm',     icon: 'move',       label: 'Mão aberta',        holdMs: 0, action: 'move o objeto na horizontal e na vertical' },
  { id: 'pinch',         icon: 'zoom-in',    label: 'Pinça',             holdMs: 0, action: 'muda a escala: quase fechada reduz, entreaberta amplia' },
  { id: 'two_fingers',   icon: 'rotate-3d',  label: 'Dois dedos juntos', holdMs: 0, action: 'gira o objeto' },
  { id: 'fist',          icon: 'rotate-ccw', label: 'Punho fechado',     holdMs: GESTURE_CONFIG.FIST_HOLD_MS,         action: 'redefine o objeto' },
  { id: 'v_sign',        icon: 'shapes',     label: 'Sinal de V',        holdMs: GESTURE_CONFIG.V_SIGN_HOLD_MS,       action: 'troca a forma' },
  { id: 'three_fingers', icon: 'palette',    label: 'Três dedos',        holdMs: GESTURE_CONFIG.THREE_FINGER_HOLD_MS, action: 'troca a cor' },
  { id: 'dual_hands',    icon: 'scaling',    label: 'Duas mãos',         holdMs: 0, action: 'muda a escala ao afastar ou aproximar as mãos' },
].map((entry) => Object.freeze(entry))));

export const SCENE_CONFIG = Object.freeze({
  FOV: 75, NEAR: 0.1, FAR: 1000, CAMERA_Z: 5,
  TRANSLATE_SPEED: 3.0, ROTATE_SPEED: 2.0, ZOOM_SPEED: 0.05,
  MIN_SCALE: 0.3, MAX_SCALE: 3.0, POSITION_LIMIT: 3.0,
  MODEL_FIT_SIZE: 3.2, // a loaded model's largest side, in scene units
  AUTO_ROTATE_X: 0.003, AUTO_ROTATE_Y: 0.005,
  FOG_NEAR: 10, FOG_FAR: 50,
  AMBIENT_INTENSITY: 0.4, DIRECTIONAL_INTENSITY: 0.8, POINT_INTENSITY: 0.5, HEMISPHERE_INTENSITY: 1.2,
  EMISSIVE_INTENSITY: 0.15, ROUGHNESS: 0.3, METALNESS: 0.7,
});

export const CAMERA_CONFIG = Object.freeze({
  WIDTH: 1280, HEIGHT: 720, FACING_MODE: 'user', IDEAL_FPS: 30, MAX_FPS: 60,
});

export const TRACKING_CONFIG = Object.freeze({
  MAX_HANDS: 2,
  // HandLandmarker (@mediapipe/tasks-vision, self-hosted in /vendor/): GPU first, CPU if WebGL fails.
  DELEGATE: /** @type {'GPU' | 'CPU'} */ ('GPU'),
  MODEL_INIT_TIMEOUT_MS: 30_000, // slow machines: fail with a message instead of loading forever
  SMOOTHING_ALPHA: 0.5,          // weight of the newest frame in the landmark moving average
  MIN_DETECTION_CONF: 0.7, MIN_PRESENCE_CONF: 0.5, MIN_TRACKING_CONF: 0.5,
  LANDMARK_RADIUS: 3, CONNECTION_LINE_WIDTH: 2, HALO_WIDTH: 2,
});

/**
 * Colours are read from ms-tokens.css at runtime (getComputedStyle), never
 * written as hex here. The object cycles through the data-viz palette.
 */
export const COLOR_TOKENS = Object.freeze({
  SCENE_BG: '--ms-bg',
  LIGHT: '--ms-text',
  LANDMARK: '--ms-text',
  LANDMARK_HALO: '--ms-media-halo',
});

/** @type {readonly { token: string, label: string }[]} */
export const OBJECT_COLORS = Object.freeze([
  { token: '--ms-chart-1', label: 'Azul' },
  { token: '--ms-chart-2', label: 'Pêssego' },
  { token: '--ms-chart-3', label: 'Índigo' },
  { token: '--ms-chart-4', label: 'Malva' },
  { token: '--ms-chart-5', label: 'Mostarda' },
  { token: '--ms-chart-6', label: 'Jade' },
].map((entry) => Object.freeze(entry)));

export const UI_CONFIG = Object.freeze({
  FPS_UPDATE_INTERVAL_MS: 500,
  HISTORY_MAX_ENTRIES: 12,
  POSE_UPDATE_MS: 500, // pose readout refresh: at most twice per second
});
