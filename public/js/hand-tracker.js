/**
 * Browser Hand Tracking — MediaPipe Hands Wrapper
 * Manages camera stream, MediaPipe model lifecycle, and landmark extraction.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 * @module  hand-tracker
 */

import { CAMERA_CONFIG, TRACKING_CONFIG } from './config.js';

export class HandTracker {
  constructor(videoEl, overlayEl, camCfg = {}, trackCfg = {}) {
    if (!(videoEl instanceof HTMLVideoElement))    throw new TypeError('videoEl must be an HTMLVideoElement');
    if (!(overlayEl instanceof HTMLCanvasElement)) throw new TypeError('overlayEl must be an HTMLCanvasElement');
    this._video    = videoEl;
    this._canvas   = overlayEl;
    this._ctx      = overlayEl.getContext('2d');
    this._camCfg   = { ...CAMERA_CONFIG,   ...camCfg   };
    this._trackCfg = { ...TRACKING_CONFIG, ...trackCfg };
    this._resultCbs  = [];
    this._errorCbs   = [];
    this._stream     = null;
    this._hands      = null;
    this._rafHandle  = null;
    this._running    = false;
    this._initialized = false;
  }

  onResults(cb) {
    if (typeof cb !== 'function') throw new TypeError('onResults callback must be a function');
    this._resultCbs.push(cb);
  }

  onError(cb) {
    if (typeof cb !== 'function') throw new TypeError('onError callback must be a function');
    this._errorCbs.push(cb);
  }

  async start() {
    if (this._running) return;
    try {
      await this._initMediaPipe();
      await this._startCamera();
      this._running = true;
      this._scheduleFrame();
    } catch (err) {
      this._emitError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  stop() {
    this._running = false;
    if (this._rafHandle !== null) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    if (this._stream)  { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
    if (this._hands)   { try { this._hands.close?.(); } catch {} this._hands = null; }
    this._initialized = false;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  get isRunning() { return this._running; }

  async _initMediaPipe() {
    if (this._initialized) return;
    if (typeof window.Hands === 'undefined')
      throw new Error('MediaPipe Hands is not loaded. Ensure the CDN script is included.');
    this._hands = new window.Hands({
      locateFile: file => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file,
    });
    this._hands.setOptions({
      maxNumHands:            this._trackCfg.MAX_HANDS,
      modelComplexity:        this._trackCfg.MODEL_COMPLEXITY,
      minDetectionConfidence: this._trackCfg.MIN_DETECTION_CONF,
      minTrackingConfidence:  this._trackCfg.MIN_TRACKING_CONF,
    });
    this._hands.onResults(raw => this._handleRawResults(raw));
    await this._hands.initialize();
    this._initialized = true;
  }

  async _startCamera() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera API (getUserMedia) is not available in this browser or context.');
    const constraints = {
      video: {
        facingMode: this._camCfg.FACING_MODE,
        width:      { ideal: this._camCfg.WIDTH  },
        height:     { ideal: this._camCfg.HEIGHT },
        frameRate:  { ideal: this._camCfg.IDEAL_FPS, max: this._camCfg.MAX_FPS },
      },
    };
    try {
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err.name === 'NotAllowedError') throw new Error('Camera access was denied by the user.');
      if (err.name === 'NotFoundError')   throw new Error('No camera device found.');
      throw err;
    }
    this._video.srcObject = this._stream;
    await new Promise((resolve, reject) => {
      this._video.onloadedmetadata = () => {
        this._canvas.width  = this._video.videoWidth;
        this._canvas.height = this._video.videoHeight;
        resolve();
      };
      this._video.onerror = () => reject(new Error('Video element failed to load camera stream'));
      this._video.play().catch(reject);
    });
  }

  _scheduleFrame() {
    if (!this._running) return;
    this._rafHandle = requestAnimationFrame(() => this._processFrame());
  }

  async _processFrame() {
    if (!this._running || !this._hands || this._video.readyState < 2) {
      this._scheduleFrame(); return;
    }
    try { await this._hands.send({ image: this._video }); }
    catch (err) { this._emitError(new Error('Frame processing error: ' + (err?.message ?? err))); }
    this._scheduleFrame();
  }

  _handleRawResults(rawResults) {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    const hands = [];
    const multiLandmarks  = rawResults.multiHandLandmarks  ?? [];
    const multiHandedness = rawResults.multiHandedness     ?? [];
    for (let i = 0; i < multiLandmarks.length; i++) {
      const landmarks  = multiLandmarks[i];
      const handedness = multiHandedness[i];
      if (!landmarks || landmarks.length !== 21) continue;
      this._drawHandOverlay(landmarks);
      hands.push({ landmarks, handedness: handedness?.label ?? 'Unknown', confidence: handedness?.score ?? 0 });
    }
    const result = { hands, timestamp: performance.now() };
    this._resultCbs.forEach(cb => { try { cb(result); } catch {} });
  }

  _drawHandOverlay(landmarks) {
    const W = this._canvas.width, H = this._canvas.height;
    if (window.HAND_CONNECTIONS) {
      this._ctx.strokeStyle = this._trackCfg.CONNECTION_COLOR;
      this._ctx.lineWidth   = this._trackCfg.CONNECTION_LINE_WIDTH;
      for (const [a, b] of window.HAND_CONNECTIONS) {
        const pa = landmarks[a], pb = landmarks[b];
        if (!pa || !pb) continue;
        this._ctx.beginPath();
        this._ctx.moveTo(pa.x * W, pa.y * H);
        this._ctx.lineTo(pb.x * W, pb.y * H);
        this._ctx.stroke();
      }
    }
    this._ctx.fillStyle = this._trackCfg.LANDMARK_COLOR;
    for (const lm of landmarks) {
      this._ctx.beginPath();
      this._ctx.arc(lm.x * W, lm.y * H, this._trackCfg.LANDMARK_RADIUS, 0, Math.PI * 2);
      this._ctx.fill();
    }
  }

  _emitError(err) {
    console.error('[HandTracker]', err.message);
    this._errorCbs.forEach(cb => { try { cb(err); } catch {} });
  }
}
