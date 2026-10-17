/**
 * Browser Hand Tracking — MediaPipe HandLandmarker Wrapper
 * Manages camera stream, HandLandmarker (@mediapipe/tasks-vision) lifecycle, and landmark extraction.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 * @module  hand-tracker
 */

import { CAMERA_CONFIG, COLOR_TOKENS, TRACKING_CONFIG } from './config.js';
import { LandmarkSmoother, withTimeout } from './utils.js';

/** @typedef {'denied' | 'not-found' | 'in-use' | 'unsupported' | 'ended' | 'model' | 'unknown'} CameraErrorCode */
/** @typedef {import('./utils.js').TrackedHand & { confidence: number }} DetectedHand */
/** @typedef {{ hands: DetectedHand[], timestamp: number }} TrackingResult */
/** @typedef {typeof import('vendor/hand-landmarker')} VisionModule */
/** @typedef {import('@mediapipe/tasks-vision').HandLandmarker} HandLandmarker */
/** @typedef {import('@mediapipe/tasks-vision').HandLandmarkerResult} HandLandmarkerResult */

/** Error with a stable `code` the UI maps to a user-facing message. */
export class CameraError extends Error {
  /**
   * @param {CameraErrorCode} code
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = 'CameraError';
    this.code = code;
  }
}

/** @type {Promise<VisionModule> | null} shared so the module is requested once per page */
let visionModulePromise = null;

/** Imports the self-hosted tasks-vision bundle (see the import map) the first time the camera starts. */
function loadVisionModule() {
  visionModulePromise ??= import('vendor/hand-landmarker').catch((err) => {
    visionModulePromise = null; // allow "Tentar novamente" to request it again
    throw new CameraError('model', `Failed to load MediaPipe Tasks Vision: ${errorText(err)}`, { cause: err });
  });
  return visionModulePromise;
}

const GET_USER_MEDIA_CODES = Object.freeze({
  NotAllowedError: 'denied', SecurityError: 'denied',
  NotFoundError: 'not-found', DevicesNotFoundError: 'not-found',
  NotReadableError: 'in-use', TrackStartError: 'in-use',
});

/** @param {unknown} err */
function errorText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * getUserMedia with every rejection mapped to a CameraError (the original is kept as `cause`).
 * @param {MediaStreamConstraints} constraints
 */
async function requestCamera(constraints) {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const code = GET_USER_MEDIA_CODES[/** @type {keyof typeof GET_USER_MEDIA_CODES} */ (name)] ?? 'unknown';
    throw new CameraError(code, `getUserMedia failed: ${name || errorText(err)}`, { cause: err });
  }
}

export class HandTracker {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} overlayEl
   * @param {Partial<typeof CAMERA_CONFIG>} [camCfg]
   * @param {Partial<typeof TRACKING_CONFIG>} [trackCfg]
   */
  constructor(videoEl, overlayEl, camCfg = {}, trackCfg = {}) {
    if (!(videoEl instanceof HTMLVideoElement))    throw new TypeError('videoEl must be an HTMLVideoElement');
    if (!(overlayEl instanceof HTMLCanvasElement)) throw new TypeError('overlayEl must be an HTMLCanvasElement');
    const ctx = overlayEl.getContext('2d');
    if (!ctx) throw new TypeError('overlayEl has no 2D context');
    this._video    = videoEl;
    this._canvas   = overlayEl;
    this._ctx      = ctx;
    this._camCfg   = { ...CAMERA_CONFIG,   ...camCfg   };
    this._trackCfg = { ...TRACKING_CONFIG, ...trackCfg };
    /** @type {((result: TrackingResult) => void)[]} */
    this._resultCbs  = [];
    /** @type {((error: CameraError) => void)[]} */
    this._errorCbs   = [];
    /** @type {MediaStream | null} */
    this._stream     = null;
    /** @type {HandLandmarker | null} */
    this._landmarker = null;
    /** @type {readonly { start: number, end: number }[]} */
    this._connections = [];
    /** @type {number | null} */
    this._rafHandle  = null;
    this._running    = false;
    this._runId       = 0; // bumped on every stop so a start in flight cannot revive an old session
    this._lastVideoTime = -1;
    this._lastTimestamp = 0;
    this._colors      = { mark: '', halo: '' };
    this._smoother    = new LandmarkSmoother({ alpha: this._trackCfg.SMOOTHING_ALPHA });
  }

  /** @param {(result: TrackingResult) => void} cb */
  onResults(cb) {
    if (typeof cb !== 'function') throw new TypeError('onResults callback must be a function');
    this._resultCbs.push(cb);
  }

  /** @param {(error: CameraError) => void} cb */
  onError(cb) {
    if (typeof cb !== 'function') throw new TypeError('onError callback must be a function');
    this._errorCbs.push(cb);
  }

  async start() {
    if (this._running) return;
    const css = getComputedStyle(document.documentElement);
    this._colors = {
      mark: css.getPropertyValue(COLOR_TOKENS.LANDMARK).trim(),
      halo: css.getPropertyValue(COLOR_TOKENS.LANDMARK_HALO).trim(),
    };
    const runId = this._runId;
    try {
      await this._startCamera();
      const vision = await loadVisionModule();
      if (runId !== this._runId) { this.stop(); return; } // stopped while starting
      await this._initLandmarker(vision);
      if (runId !== this._runId) { this.stop(); return; }
      this._running = true;
      this._scheduleFrame(this._runId);
    } catch (err) {
      if (runId !== this._runId) { this.stop(); return; }
      const error = err instanceof CameraError
        ? err
        : new CameraError('unknown', err instanceof Error ? err.message : String(err), { cause: err });
      this.stop();
      this._emitError(error);
      throw error;
    }
  }

  stop() {
    this._running = false;
    this._runId += 1;
    if (this._rafHandle !== null) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    if (this._stream)  { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
    this._video.srcObject = null;
    if (this._landmarker) { try { this._landmarker.close(); } catch {} this._landmarker = null; }
    this._lastVideoTime = -1;
    this._smoother.reset();
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  get isRunning() { return this._running; }

  /** @param {VisionModule} vision */
  async _initLandmarker(vision) {
    const { FilesetResolver, HandLandmarker, WASM_BASE_URL, MODEL_URL } = vision;
    this._connections = HandLandmarker.HAND_CONNECTIONS;
    const cfg = this._trackCfg;
    /** @param {'GPU' | 'CPU'} delegate */
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: /** @type {const} */ ('VIDEO'),
      numHands:                   cfg.MAX_HANDS,
      minHandDetectionConfidence: cfg.MIN_DETECTION_CONF,
      minHandPresenceConfidence:  cfg.MIN_PRESENCE_CONF,
      minTrackingConfidence:      cfg.MIN_TRACKING_CONF,
    });
    const create = async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      if (cfg.DELEGATE === 'CPU') return HandLandmarker.createFromOptions(fileset, options('CPU'));
      try {
        return await HandLandmarker.createFromOptions(fileset, options('GPU'));
      } catch (err) {
        console.warn('[HandTracker] GPU delegate unavailable, using CPU:', errorText(err));
        return HandLandmarker.createFromOptions(fileset, options('CPU'));
      }
    };
    const pending = create();
    try {
      this._landmarker = await withTimeout(
        pending,
        cfg.MODEL_INIT_TIMEOUT_MS,
        () => new CameraError('model', `HandLandmarker did not initialize within ${cfg.MODEL_INIT_TIMEOUT_MS} ms`),
      );
    } catch (err) {
      pending.then((late) => late.close(), () => {}); // a model that finishes after the timeout is discarded
      throw err instanceof CameraError ? err : new CameraError('model', `HandLandmarker failed to initialize: ${errorText(err)}`, { cause: err });
    }
  }

  async _startCamera() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new CameraError('unsupported', 'Camera API (getUserMedia) is not available in this browser or context.');
    const constraints = {
      video: {
        facingMode: this._camCfg.FACING_MODE,
        width:      { ideal: this._camCfg.WIDTH  },
        height:     { ideal: this._camCfg.HEIGHT },
        frameRate:  { ideal: this._camCfg.IDEAL_FPS, max: this._camCfg.MAX_FPS },
      },
    };
    try {
      this._stream = await requestCamera(constraints);
    } catch (err) {
      const unsupportedConstraints = err instanceof CameraError && err.cause instanceof Error
        && (err.cause.name === 'OverconstrainedError' || err.cause.name === 'ConstraintNotSatisfiedError');
      if (!unsupportedConstraints) throw err;
      this._stream = await requestCamera({ video: true });
    }
    // Unplugged camera or permission revoked mid-session: the track ends and the video freezes.
    for (const track of this._stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (!this._running) return;
        this.stop();
        this._emitError(new CameraError('ended', 'Camera track ended'));
      }, { once: true });
    }
    this._video.muted = true;
    this._video.playsInline = true;
    this._video.srcObject = this._stream;
    /** @type {Promise<void>} */
    const ready = new Promise((resolve, reject) => {
      this._video.onloadedmetadata = () => {
        this._canvas.width  = this._video.videoWidth;
        this._canvas.height = this._video.videoHeight;
        resolve();
      };
      this._video.onerror = () => reject(new Error('Video element failed to load camera stream'));
      this._video.play().catch(reject);
    });
    await ready;
  }

  /** @param {number} runId */
  _scheduleFrame(runId) {
    if (!this._running || runId !== this._runId) return;
    this._rafHandle = requestAnimationFrame(() => this._processFrame(runId));
  }

  /** @param {number} runId */
  _processFrame(runId) {
    if (!this._running || runId !== this._runId) return;
    const landmarker = this._landmarker;
    const video = this._video;
    // Only new camera frames go to the model; detectForVideo needs increasing timestamps.
    if (!landmarker || video.readyState < 2 || video.currentTime === this._lastVideoTime) {
      this._scheduleFrame(runId); return;
    }
    this._lastVideoTime = video.currentTime;
    const timestamp = Math.max(performance.now(), this._lastTimestamp + 1);
    this._lastTimestamp = timestamp;
    /** @type {HandLandmarkerResult} */
    let raw;
    try {
      raw = landmarker.detectForVideo(video, timestamp);
    } catch (err) {
      // A failing model fails every frame: stop once instead of erroring 60 times a second.
      this.stop();
      this._emitError(new CameraError('model', `Frame processing failed: ${errorText(err)}`, { cause: err }));
      return;
    }
    this._handleRawResults(raw, timestamp);
    this._scheduleFrame(runId);
  }

  /**
   * @param {HandLandmarkerResult} rawResults
   * @param {number} timestamp
   */
  _handleRawResults(rawResults, timestamp) {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    /** @type {DetectedHand[]} */
    const hands = [];
    const multiLandmarks  = rawResults.landmarks  ?? [];
    const multiHandedness = rawResults.handedness ?? [];
    for (let i = 0; i < multiLandmarks.length; i++) {
      const landmarks  = multiLandmarks[i];
      const handedness = multiHandedness[i]?.[0];
      if (!landmarks || landmarks.length !== 21) continue;
      this._drawHandOverlay(landmarks);
      hands.push({ landmarks, handedness: handedness?.categoryName || 'Unknown', confidence: handedness?.score ?? 0 });
    }
    // The overlay shows the raw detection; gestures use the smoothed landmarks.
    /** @type {TrackingResult} */
    const result = { hands: this._smoother.smooth(hands), timestamp };
    this._resultCbs.forEach(cb => { try { cb(result); } catch {} });
  }

  /** Light marks over a dark halo so the skeleton reads on any camera frame. */
  /** @param {import('./utils.js').Point[]} landmarks */
  _drawHandOverlay(landmarks) {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    const { LANDMARK_RADIUS: r, CONNECTION_LINE_WIDTH: line, HALO_WIDTH: halo } = this._trackCfg;
    /** @param {string} color @param {number} width */
    const strokeConnections = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const { start, end } of this._connections) {
        const pa = landmarks[start], pb = landmarks[end];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * W, pa.y * H);
        ctx.lineTo(pb.x * W, pb.y * H);
        ctx.stroke();
      }
    };
    /** @param {string} color @param {number} radius */
    const fillPoints = (color, radius) => {
      ctx.fillStyle = color;
      for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * W, lm.y * H, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    strokeConnections(this._colors.halo, line + halo * 2);
    fillPoints(this._colors.halo, r + halo);
    strokeConnections(this._colors.mark, line);
    fillPoints(this._colors.mark, r);
  }

  /** @param {CameraError} err */
  _emitError(err) {
    console.error('[HandTracker]', err.message);
    this._errorCbs.forEach(cb => { try { cb(err); } catch {} });
  }
}
