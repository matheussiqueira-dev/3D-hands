// Ambient types for the browser globals and import-map specifiers the app
// touches. Type-check only; kept outside public/ so it is never deployed.

/**
 * Self-hosted tasks-vision bundle written by scripts/build-vendor.mjs and
 * mapped in the page's import map: the two classes the app uses plus the
 * URLs of the WASM fileset and of the hand_landmarker.task model.
 */
declare module 'vendor/hand-landmarker' {
  export { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
  export const WASM_BASE_URL: string;
  export const MODEL_URL: string;
}

interface Window {
  /** Exposed for the Playwright tests. */
  __app?: import('../public/js/app.js').App;
}
