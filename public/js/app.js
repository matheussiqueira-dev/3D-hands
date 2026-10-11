/**
 * Main Application Orchestrator
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 */

import { HandTracker } from "./hand-tracker.js";
import { GestureRecognizer } from "./gesture-recognizer.js";
import { Scene3D } from "./scene-3d.js";
import { FPSCounter } from "./utils.js";
import { GESTURE_CATALOG, UI_CONFIG } from "./config.js";
import { cameraErrorMessage, formatHold, formatPose } from "./format.js";

export class App {
  constructor() {
    this._fps = new FPSCounter(60);
    this._recognizer = new GestureRecognizer();
    this._history = [];
    this._lastGesture = null;
    this._running = false;
    this._dom = {};
    this._scene = null;
    this._tracker = null;
  }

  async init() {
    this._bindDom();
    this._initScene();
    this._initTracker();
    this._bindKeyboard();
    this._bindButtons();
    this._startTelemetry();
    this._renderGuide();
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
      guide: ["gesture-guide-list"],
      alert: ["camera-alert"],
      alertMessage: ["camera-alert-message"],
      retry: ["retry-btn"],
      poseShape: ["object-type"],
      posePosition: ["object-position"],
      poseRotation: ["object-rotation"],
      poseScale: ["object-scale"],
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
    // Start failures are surfaced by start(); this covers errors while running.
    this._tracker.onError((error) => {
      if (!this._running) return;
      this._setStatus("error", error.message);
      this._showCameraError(error);
    });
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
      this._updateGestureDisplay(primary.name);
      this._recordHistory(primary.name);
      return;
    }

    const holding = gestures.find((g) => typeof g.progress === "number" && g.progress < 1);
    if (holding) {
      this._updateGestureDisplay(holding.name, holding.progress);
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
        this._setStatus("info", `Shape: ${this._scene.currentShape}`);
        break;
      case "three_fingers":
        this._scene.nextColor();
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
    this._dom.retry?.addEventListener("click", () => this.start());
  }

  async start() {
    if (this._running) return;
    if (!this._tracker) {
      this._setStatus("error", "Hand tracker unavailable");
      return;
    }

    this._running = true;
    this._hideCameraError();
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
      this._showCameraError(error);
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

  /** @param {{ code?: string } | undefined} error */
  _showCameraError(error) {
    if (!this._dom.alert || !this._dom.alertMessage) return;
    this._dom.alertMessage.textContent = cameraErrorMessage(error?.code);
    // Retrying cannot help when there is no camera or no camera API.
    if (this._dom.retry) this._dom.retry.hidden = error?.code === "not-found" || error?.code === "unsupported";
    this._dom.alert.hidden = false;
  }

  _hideCameraError() {
    if (this._dom.alert) this._dom.alert.hidden = true;
  }

  _recordHistory(gesture) {
    if (gesture === this._lastGesture) return;

    this._lastGesture = gesture;
    this._history.unshift({
      gesture,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (this._history.length > UI_CONFIG.HISTORY_MAX_ENTRIES) {
      this._history.pop();
    }

    this._renderHistory();
  }

  _renderGuide() {
    const list = this._dom.guide;
    if (!list) return;
    list.replaceChildren(...GESTURE_CATALOG.map((entry) => {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = entry.holdMs > 0 ? `${entry.label} (${formatHold(entry.holdMs)})` : entry.label;
      const action = document.createElement("span");
      action.textContent = entry.action;
      item.append(name, action);
      return item;
    }));
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
          `<li class="history-entry"><span class="history-gesture">${entry.gesture.replace(/_/g, " ")}</span><span class="history-meta">${entry.timestamp}</span></li>`
      )
      .join("");
  }

  /** @param {string} gesture @param {number} [holdProgress] measured hold fraction, 0 to 1 */
  _updateGestureDisplay(gesture, holdProgress) {
    const element = this._dom.gesture;
    if (!element) return;

    const label = gesture.replace(/_/g, " ");
    element.textContent = typeof holdProgress === "number"
      ? `${label} (hold ${Math.round(holdProgress * 100)}%)`
      : label;
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
    this._renderPose();
    setInterval(() => this._renderPose(), UI_CONFIG.POSE_UPDATE_MS);
  }

  _renderPose() {
    if (!this._scene) return;
    const text = formatPose(this._scene.getPose());
    const fields = [
      [this._dom.poseShape, text.shape],
      [this._dom.posePosition, text.position],
      [this._dom.poseRotation, text.rotation],
      [this._dom.poseScale, text.scale],
    ];
    for (const [element, value] of fields) {
      if (element && element.textContent !== value) element.textContent = value;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const app = new App();
  await app.init();
  window.__app = app;
});
