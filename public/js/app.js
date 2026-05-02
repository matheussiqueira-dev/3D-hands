/**
 * Main Application Orchestrator
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 */

import { HandTracker } from "./hand-tracker.js";
import { GestureRecognizer } from "./gesture-recognizer.js";
import { Scene3D } from "./scene-3d.js";
import { FPSCounter, generateSessionId, throttle } from "./utils.js";
import { API_CONFIG, UI_CONFIG } from "./config.js";

export class App {
  constructor() {
    this._sessionId = generateSessionId(API_CONFIG.SESSION_ID_LENGTH);
    this._fps = new FPSCounter(60);
    this._recognizer = new GestureRecognizer();
    this._history = [];
    this._lastGesture = null;
    this._running = false;
    this._dom = {};
    this._scene = null;
    this._tracker = null;
    this._logGesture = throttle((gesture, confidence) => this._postGestureEvent(gesture, confidence), API_CONFIG.LOG_INTERVAL_MS);
  }

  async init() {
    this._bindDom();
    this._initScene();
    this._initTracker();
    this._bindKeyboard();
    this._bindButtons();
    this._startTelemetry();
    this._renderHistory();
    this._setStatus("ready", "System ready");
  }

  _bindDom() {
    const aliases = {
      video: ["webcam", "video"],
      overlay: ["output-canvas", "overlay-canvas"],
      scene: ["scene-canvas"],
      fps: ["fps-counter", "fps-display"],
      gesture: ["gesture-status", "gesture-display"],
      camera: ["camera-status", "status-text"],
      start: ["start-btn"],
      stop: ["stop-btn"],
      history: ["history-list"],
    };

    for (const key of Object.keys(aliases)) {
      let element = null;
      for (const id of aliases[key]) {
        element = document.getElementById(id);
        if (element) break;
      }
      if (!element) {
        console.warn(`[App] ${aliases[key][0]} not found`);
      }
      this._dom[key] = element;
    }
  }

  _initScene() {
    const canvas = this._dom.scene;
    if (!canvas) return;

    try {
      this._scene = new Scene3D(canvas);
      this._scene.init();
      this._scene.animate();
    } catch (error) {
      this._setStatus("error", `3D scene failed: ${error.message}`);
    }
  }

  _initTracker() {
    const video = this._dom.video;
    const overlay = this._dom.overlay;
    if (!video || !overlay) return;

    this._tracker = new HandTracker(video, overlay);
    this._tracker.onResults((result) => this._handleResult(result));
    this._tracker.onError((error) => this._setStatus("error", error.message));
  }

  _handleResult(result) {
    this._fps.tick();

    const hand1 = result.hands[0]?.landmarks ?? null;
    const hand2 = result.hands[1]?.landmarks ?? null;

    if (!hand1) {
      this._recognizer.reset();
      this._updateGestureDisplay("Sem mãos detectadas");
      return;
    }

    const gestures = this._recognizer.recognize(hand1, hand2);
    const primary = this._recognizer.getPrimaryGesture(gestures);

    if (primary?.active) {
      this._applyToScene(primary);
      this._updateGestureDisplay(primary.name, primary.confidence);
      this._recordHistory(primary.name, primary.confidence);
      this._logGesture(primary.name, primary.confidence);
      return;
    }

    this._updateGestureDisplay("tracking...");
  }

  _applyToScene(gesture) {
    if (!this._scene) return;

    switch (gesture.name) {
      case "open_palm":
        this._scene.translate(gesture.data.delta);
        this._scene.setAutoRotate(false);
        break;
      case "pinch":
        this._scene.zoom(gesture.data.distance < 0.03 ? -1 : 1);
        break;
      case "two_fingers":
        this._scene.rotate(gesture.data.angle * 0.05);
        break;
      case "fist":
        this._scene.reset();
        this._setStatus("info", "Reset via fist");
        break;
      case "v_sign":
        this._scene.nextShape();
        this._recognizer.resetTimer("v_sign");
        this._setStatus("info", `Shape: ${this._scene.currentShape}`);
        break;
      case "three_fingers":
        this._scene.nextColor();
        this._recognizer.resetTimer("three_fingers");
        break;
      case "dual_hands":
        if (gesture.data?.scaleDelta) {
          this._scene.zoom(gesture.data.scaleDelta * 10);
        }
        break;
    }
  }

  _bindKeyboard() {
    const handlers = {
      ArrowUp: () => this._scene?.translate({ x: 0, y: -0.05 }),
      ArrowDown: () => this._scene?.translate({ x: 0, y: 0.05 }),
      ArrowLeft: () => this._scene?.translate({ x: -0.05, y: 0 }),
      ArrowRight: () => this._scene?.translate({ x: 0.05, y: 0 }),
      r: () => {
        this._scene?.reset();
        this._setStatus("info", "Reset via keyboard");
      },
      n: () => {
        this._scene?.nextShape();
        this._setStatus("info", `Shape: ${this._scene?.currentShape}`);
      },
      c: () => this._scene?.nextColor(),
      "+": () => this._scene?.zoom(1),
      "-": () => this._scene?.zoom(-1),
      " ": () => this._scene?.setAutoRotate(true),
      Escape: () => this.stop(),
    };

    document.addEventListener("keydown", (event) => {
      const handler = handlers[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    });
  }

  _bindButtons() {
    this._dom.start?.addEventListener("click", () => this.start());
    this._dom.stop?.addEventListener("click", () => this.stop());
  }

  async start() {
    if (this._running) return;
    if (!this._tracker) {
      this._setStatus("error", "Hand tracker unavailable");
      return;
    }

    this._running = true;
    this._setStatus("loading", "Initializing camera and hand tracking model...");

    try {
      await this._tracker.start();
      if (!this._tracker.isRunning) {
        throw new Error("Hand tracking failed to start");
      }
      this._setStatus("active", "Hand tracking active");
      if (this._dom.start) this._dom.start.disabled = true;
      if (this._dom.stop) this._dom.stop.disabled = false;
    } catch (error) {
      this._running = false;
      this._setStatus("error", error?.message ?? "Failed to start tracking");
      if (this._dom.start) this._dom.start.disabled = false;
      if (this._dom.stop) this._dom.stop.disabled = true;
    }
  }

  stop() {
    if (!this._running) return;

    this._running = false;
    this._tracker?.stop();
    this._recognizer.reset();
    this._setStatus("ready", "Tracking stopped");
    if (this._dom.start) this._dom.start.disabled = false;
    if (this._dom.stop) this._dom.stop.disabled = true;
  }

  _recordHistory(gesture, confidence) {
    if (gesture === this._lastGesture) return;

    this._lastGesture = gesture;
    this._history.unshift({
      gesture,
      confidence: Math.round(confidence * 100),
      timestamp: new Date().toLocaleTimeString(),
    });

    if (this._history.length > UI_CONFIG.HISTORY_MAX_ENTRIES) {
      this._history.pop();
    }

    this._renderHistory();
  }

  _renderHistory() {
    const list = this._dom.history;
    if (!list) return;

    if (!this._history.length) {
      list.innerHTML = '<li class="history-empty">No gestures recorded yet</li>';
      return;
    }

    list.innerHTML = this._history
      .map(
        (entry) =>
          `<li class="history-entry"><span class="history-gesture">${entry.gesture.replace(/_/g, " ")}</span><span class="history-meta">${entry.confidence}% &middot; ${entry.timestamp}</span></li>`
      )
      .join("");
  }

  async _postGestureEvent(gesture, confidence) {
    try {
      const response = await fetch(API_CONFIG.GESTURE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gesture,
          sessionId: this._sessionId,
          metadata: { confidence: Math.round(confidence * 100) },
        }),
      });

      if (!response.ok) {
        console.warn("[App] API failed:", response.status);
      }
    } catch (error) {
      console.debug("[App] API unreachable:", error?.message);
    }
  }

  _updateGestureDisplay(gesture, confidence) {
    const element = this._dom.gesture;
    if (!element) return;

    element.textContent = confidence
      ? `${gesture.replace(/_/g, " ")} (${Math.round(confidence * 100)}%)`
      : gesture;
  }

  _setStatus(type, message) {
    const element = this._dom.camera;
    if (element) {
      element.textContent =
        type === "active"
          ? "Camera: Active"
          : type === "loading"
            ? "Camera: Starting..."
            : type === "error"
              ? "Camera: Error"
              : "Camera: Offline";
      element.classList.toggle("status-online", type === "active");
      element.classList.toggle("status-offline", type === "error" || type === "ready");
    }

    console.log(`[App][${type.toUpperCase()}] ${message}`);
  }

  _startTelemetry() {
    setInterval(() => {
      const element = this._dom.fps;
      if (element) element.textContent = `FPS: ${this._fps.value}`;
    }, UI_CONFIG.FPS_UPDATE_INTERVAL_MS);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const app = new App();
  await app.init();
  window.__app = app;
});
