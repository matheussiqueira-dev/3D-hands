// Ambient types for the browser globals the app touches. Type-check only;
// kept outside public/ so it is never deployed.

/** Landmark as produced by MediaPipe Hands (normalized image coordinates). */
interface MediaPipeLandmark { x: number; y: number; z?: number }

interface MediaPipeHandsResults {
  multiHandLandmarks?: MediaPipeLandmark[][];
  multiHandedness?: { label: string; score: number }[];
}

/** The subset of the legacy `@mediapipe/hands` API this app uses. */
interface MediaPipeHands {
  setOptions(options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }): void;
  onResults(callback: (results: MediaPipeHandsResults) => void): void;
  initialize(): Promise<void>;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close?(): void;
}

interface Window {
  /** Injected by hands.js (loaded on demand with SRI). */
  Hands?: new (config: { locateFile: (file: string) => string }) => MediaPipeHands;
  HAND_CONNECTIONS?: [number, number][];
  /** Exposed for the Playwright tests. */
  __app?: import('../public/js/app.js').App;
}
