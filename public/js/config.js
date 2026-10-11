/**
 * Application Configuration — Central Constants Module
 * Single source of truth for all tunable parameters.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 * @module  config
 */

export const GESTURE_CONFIG = Object.freeze({
  PINCH_THRESHOLD:         0.05,
  PINCH_RELEASE_THRESHOLD: 0.08,
  FINGER_EXTENDED_RATIO:   1.05,
  THUMB_EXTENDED_X_DELTA:  0.04,
  // Index-to-middle tip gap divided by palm length (wrist to middle knuckle):
  // below it the two fingers are "together" (rotate), at or above it a V sign.
  V_SIGN_MIN_SPREAD_RATIO: 0.35,
  FIST_HOLD_MS:         2000,
  V_SIGN_HOLD_MS:       1000,
  THREE_FINGER_HOLD_MS:  800,
  PALM_HOLD_MS:          500,
  GESTURE_DEBOUNCE_MS:   150,
  MIN_OPEN_FINGERS:    4,
  MIN_THREE_FINGERS:   3,
  MIN_TWO_FINGERS:     2,
  TRANSLATION_DEADZONE: 0.018,
  ROTATION_DEADZONE:    0.015,
  SCALE_DEADZONE:       0.008,
});

/**
 * Every gesture the browser recognizer emits, in display order. The on-screen
 * guide and the README table are checked against this list by the tests.
 * `holdMs` is 0 for continuous gestures.
 */
export const GESTURE_CATALOG = Object.freeze([
  { id: 'open_palm',     label: 'Mão aberta',        holdMs: 0, action: 'move o objeto na horizontal e na vertical' },
  { id: 'pinch',         label: 'Pinça',             holdMs: 0, action: 'muda a escala: quase fechada reduz, entreaberta amplia' },
  { id: 'two_fingers',   label: 'Dois dedos juntos', holdMs: 0, action: 'gira o objeto' },
  { id: 'fist',          label: 'Punho fechado',     holdMs: GESTURE_CONFIG.FIST_HOLD_MS,         action: 'redefine o objeto' },
  { id: 'v_sign',        label: 'Sinal de V',        holdMs: GESTURE_CONFIG.V_SIGN_HOLD_MS,       action: 'troca a forma' },
  { id: 'three_fingers', label: 'Três dedos',        holdMs: GESTURE_CONFIG.THREE_FINGER_HOLD_MS, action: 'troca a cor' },
  { id: 'dual_hands',    label: 'Duas mãos',         holdMs: 0, action: 'muda a escala ao afastar ou aproximar as mãos' },
].map(Object.freeze));

export const SCENE_CONFIG = Object.freeze({
  FOV: 75, NEAR: 0.1, FAR: 1000, CAMERA_Z: 5,
  TRANSLATE_SPEED: 3.0, ROTATE_SPEED: 2.0, ZOOM_SPEED: 0.05,
  MIN_SCALE: 0.3, MAX_SCALE: 3.0, POSITION_LIMIT: 3.0,
  AUTO_ROTATE_X: 0.003, AUTO_ROTATE_Y: 0.005,
  FOG_NEAR: 10, FOG_FAR: 50, BG_COLOR: 0x020406,
  AMBIENT_INTENSITY: 0.4, DIRECTIONAL_INTENSITY: 0.8, POINT_INTENSITY: 0.5,
  EMISSIVE_INTENSITY: 0.15, ROUGHNESS: 0.3, METALNESS: 0.7,
});

export const CAMERA_CONFIG = Object.freeze({
  WIDTH: 1280, HEIGHT: 720, FACING_MODE: 'user', IDEAL_FPS: 30, MAX_FPS: 60,
});

/** Must match the @mediapipe/hands version loaded by index.html. */
export const MEDIAPIPE_HANDS_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/';

export const TRACKING_CONFIG = Object.freeze({
  MAX_HANDS: 2, MODEL_COMPLEXITY: 1,
  MIN_DETECTION_CONF: 0.7, MIN_TRACKING_CONF: 0.5,
  LANDMARK_RADIUS: 3, CONNECTION_LINE_WIDTH: 1,
  LANDMARK_COLOR: '#00FFFF', CONNECTION_COLOR: '#00BFFF',
});

export const UI_CONFIG = Object.freeze({
  FPS_UPDATE_INTERVAL_MS: 500,
  GESTURE_DISPLAY_DURATION_MS: 1500,
  HISTORY_MAX_ENTRIES: 12,
  TELEMETRY_UPDATE_MS: 100,
  POSE_UPDATE_MS: 500, // pose readout refresh: at most twice per second
  STATUS_FADE_MS: 300,
});

export const COLOR_PALETTE = Object.freeze({
  CYAN:   0x00FFFF,
  ORANGE: 0xFF6B35,
  GREEN:  0x39FF14,
  PURPLE: 0xBF00FF,
  BLUE:   0x0066FF,
});
