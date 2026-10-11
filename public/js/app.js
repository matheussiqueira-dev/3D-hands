/**
 * Main Application Orchestrator
 * Wires the hand tracker, the gesture recognizer and the 3D scene to the page.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 */

import { HandTracker } from "./hand-tracker.js";
import { GestureRecognizer } from "./gesture-recognizer.js";
import { Scene3D } from "./scene-3d.js";
import { FPSCounter } from "./utils.js";
import { GESTURE_CATALOG, OBJECT_COLORS, UI_CONFIG } from "./config.js";
import { SHAPE_LABELS, cameraErrorMessage, formatHistoryEntry, formatHold, formatPose } from "./format.js";
import { createIcon } from "./icons.js";

/** Camera states and their chip text. */
const CAMERA_LABELS = Object.freeze({
  off: "Câmera: desligada",
  loading: "Câmera: iniciando",
  active: "Câmera: ativa",
  error: "Câmera: erro",
});

const HINTS = Object.freeze({
  off: "Os gestos acendem aqui quando a câmera estiver ativa.",
  loading: "Carregando modelo de mãos…",
  noHand: "Mostre a mão para a câmera, com a palma voltada para a tela.",
});

/** Elements whose own keyboard behaviour must not be hijacked. */
const INTERACTIVE = "button, a, summary, input, select, textarea, .gesture-panel";

export class App {
  constructor() {
    this._fps = new FPSCounter(60);
    this._recognizer = new GestureRecognizer();
    this._history = [];
    this._lastGesture = null;
    this._running = false;
    this._cameraState = "off";
    this._handCount = 0;
    this._dom = {};
    this._rows = new Map();
    this._scene = null;
    this._tracker = null;
  }

  async init() {
    this._bindDom();
    this._initScene();
    this._initTracker();
    this._renderGesturePanel();
    this._bindKeyboard();
    this._bindButtons();
    this._startTelemetry();
    this._renderHistory();
    this._setCameraState("off");
  }

  _bindDom() {
    const ids = {
      video: "webcam", overlay: "output-canvas", scene: "scene-canvas", sceneError: "scene-error",
      fps: "fps-counter", camera: "camera-status", hands: "hands-status", hint: "hand-hint",
      placeholder: "camera-placeholder", start: "start-btn", startLabel: "start-label", stop: "stop-btn",
      reset: "reset-btn", keyboardLink: "keyboard-link", shortcuts: "atalhos", history: "history-list",
      panel: "gesture-panel", alert: "camera-alert", alertMessage: "camera-alert-message", retry: "retry-btn",
      poseShape: "object-type", poseColor: "object-color", posePosition: "object-position",
      poseRotation: "object-rotation", poseScale: "object-scale", announcer: "announcer",
    };
    for (const [key, id] of Object.entries(ids)) {
      this._dom[key] = document.getElementById(id);
      if (!this._dom[key]) console.warn(`[App] #${id} not found`);
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
      this._scene = null;
      if (this._dom.sceneError) this._dom.sceneError.hidden = false;
      console.error("[App] 3D scene failed:", error?.message);
    }
  }

  _initTracker() {
    const { video, overlay } = this._dom;
    if (!video || !overlay) return;

    this._tracker = new HandTracker(video, overlay);
    this._tracker.onResults((result) => this._handleResult(result));
    // Start failures are surfaced by start(); this covers errors while running.
    this._tracker.onError((error) => {
      if (!this._running) return;
      this._setCameraState("error");
      this._showCameraError(error);
    });
  }

  _handleResult(result) {
    this._fps.tick();
    this._setHandCount(result.hands.length);

    const hand1 = result.hands[0]?.landmarks ?? null;
    const hand2 = result.hands[1]?.landmarks ?? null;

    if (!hand1) {
      this._recognizer.reset();
      this._highlightGesture(null);
      return;
    }

    const gestures = this._recognizer.recognize(hand1, hand2);
    const primary = this._recognizer.getPrimaryGesture(gestures);
    const holding = gestures.find((g) => typeof g.progress === "number" && g.progress < 1);

    for (const g of gestures) {
      if (typeof g.progress === "number") this._setHoldProgress(g.name, g.progress);
    }

    if (primary?.active) {
      const detail = this._applyToScene(primary);
      this._recordHistory(primary.name, detail);
    }
    this._highlightGesture(primary?.active ? primary.name : holding?.name ?? null);
  }

  /** Applies a gesture and returns a short PT-BR detail for the history, if any. */
  _applyToScene(gesture) {
    if (!this._scene) return undefined;

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
        return this._resetObject();
      case "v_sign":
        return this._nextShape();
      case "three_fingers":
        return this._nextColor();
      case "dual_hands":
        if (gesture.data?.scaleDelta) {
          this._scene.zoom(gesture.data.scaleDelta * 10);
        }
        break;
    }
    return undefined;
  }

  _resetObject() {
    this._scene?.reset();
    this._announce("Objeto redefinido.");
    return "objeto redefinido";
  }

  _nextShape() {
    if (!this._scene) return undefined;
    this._scene.nextShape();
    const label = SHAPE_LABELS[this._scene.currentShape];
    this._announce(`Forma: ${label}.`);
    return `forma: ${label}`;
  }

  _nextColor() {
    if (!this._scene) return undefined;
    this._scene.nextColor();
    const label = OBJECT_COLORS[this._scene.getPose().colorIndex].label;
    this._announce(`Cor: ${label}.`);
    return `cor: ${label}`;
  }

  _bindKeyboard() {
    const step = 0.05;
    const handlers = {
      ArrowUp: () => this._scene?.translate({ x: 0, y: -step }),
      ArrowDown: () => this._scene?.translate({ x: 0, y: step }),
      ArrowLeft: () => this._scene?.translate({ x: -step, y: 0 }),
      ArrowRight: () => this._scene?.translate({ x: step, y: 0 }),
      r: () => this._resetObject(),
      n: () => this._nextShape(),
      c: () => this._nextColor(),
      "+": () => this._scene?.zoom(1),
      "=": () => this._scene?.zoom(1),
      "-": () => this._scene?.zoom(-1),
      " ": () => this._scene?.setAutoRotate(true),
      Escape: () => this.stop(),
    };

    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = handlers[key];
      if (!handler) return;
      if (key !== "Escape" && event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      event.preventDefault();
      handler();
    });
  }

  _bindButtons() {
    this._dom.start?.addEventListener("click", () => this.start());
    this._dom.stop?.addEventListener("click", () => this.stop());
    this._dom.retry?.addEventListener("click", () => this.start());
    this._dom.reset?.addEventListener("click", () => this._resetObject());
    this._dom.keyboardLink?.addEventListener("click", () => {
      if (this._dom.shortcuts) this._dom.shortcuts.open = true;
    });
  }

  async start() {
    if (this._running) return;
    if (!this._tracker) {
      this._setCameraState("error");
      this._showCameraError({ code: "unsupported" });
      return;
    }

    this._running = true;
    this._hideCameraError();
    this._setCameraState("loading");

    try {
      await this._tracker.start();
      if (!this._tracker.isRunning) {
        throw new Error("Hand tracking failed to start");
      }
      this._setCameraState("active");
    } catch (error) {
      this._running = false;
      this._setCameraState("error");
      this._showCameraError(error);
    }
  }

  stop() {
    if (!this._running) return;

    this._running = false;
    this._tracker?.stop();
    this._recognizer.reset();
    this._fps = new FPSCounter(60);
    this._setHandCount(0);
    this._highlightGesture(null);
    this._setCameraState("off");
  }

  /** @param {"off" | "loading" | "active" | "error"} state */
  _setCameraState(state) {
    const changed = state !== this._cameraState;
    this._cameraState = state;
    const { camera, start, startLabel, stop, placeholder } = this._dom;

    if (camera) camera.textContent = CAMERA_LABELS[state];
    if (start) {
      start.hidden = state === "active";
      start.setAttribute("aria-busy", String(state === "loading"));
      if (startLabel) startLabel.textContent = state === "loading" ? "Carregando modelo de mãos…" : "Ativar câmera";
    }
    if (stop) stop.hidden = state !== "active";
    if (placeholder) {
      placeholder.hidden = state === "active";
      placeholder.textContent = state === "loading" ? "Iniciando câmera…" : "Câmera desligada";
    }
    // Keep keyboard focus on a visible control when the buttons swap.
    if (state === "active" && document.activeElement === start) stop?.focus();
    if (state === "off" && document.activeElement === stop) start?.focus();

    this._updateHint();
    if (changed && state !== "error") this._announce(`${CAMERA_LABELS[state]}.`);
  }

  _setHandCount(count) {
    if (count === this._handCount) return;
    this._handCount = count;
    if (this._dom.hands) this._dom.hands.textContent = `Mãos: ${count}`;
    this._updateHint();
  }

  _updateHint() {
    const hint = this._dom.hint;
    if (!hint) return;
    let text = HINTS.off;
    if (this._cameraState === "loading") text = HINTS.loading;
    if (this._cameraState === "active") text = this._handCount === 0 ? HINTS.noHand : "";
    hint.textContent = text;
    hint.hidden = text === "";
  }

  /** @param {{ code?: string } | undefined} error */
  _showCameraError(error) {
    if (!this._dom.alert || !this._dom.alertMessage) return;
    this._dom.alertMessage.textContent = cameraErrorMessage(error?.code);
    // Retrying cannot help when there is no camera or no camera API.
    if (this._dom.retry) this._dom.retry.hidden = error?.code === "not-found" || error?.code === "unsupported";
    this._dom.alert.hidden = false;
    if (error instanceof Error) console.warn("[App] camera:", error.message);
  }

  _hideCameraError() {
    if (this._dom.alert) this._dom.alert.hidden = true;
  }

  _renderGesturePanel() {
    const panel = this._dom.panel;
    if (!panel) return;
    panel.replaceChildren(...GESTURE_CATALOG.map((entry) => {
      const row = document.createElement("li");
      row.className = "gesture-row";
      row.dataset.gesture = entry.id;

      const name = document.createElement("span");
      name.className = "gesture-row__name";
      name.textContent = entry.label;

      const meta = document.createElement("span");
      meta.className = "gesture-row__meta";
      meta.textContent = entry.holdMs > 0 ? `${formatHold(entry.holdMs)} · ${entry.action}` : entry.action;

      row.append(createIcon(entry.icon), name, meta);

      let fill = null;
      if (entry.holdMs > 0) {
        const track = document.createElement("span");
        track.className = "gesture-row__hold";
        track.setAttribute("aria-hidden", "true");
        fill = document.createElement("span");
        fill.className = "gesture-row__fill";
        track.append(fill);
        row.append(track);
      }
      this._rows.set(entry.id, { row, fill });
      return row;
    }));
  }

  /** @param {string | null} id gesture currently recognized (active or holding) */
  _highlightGesture(id) {
    for (const [gesture, { row, fill }] of this._rows) {
      const on = gesture === id;
      row.classList.toggle("is-active", on);
      if (!on && fill) fill.style.transform = "scaleX(0)";
    }
  }

  _setHoldProgress(id, progress) {
    const fill = this._rows.get(id)?.fill;
    if (fill) fill.style.transform = `scaleX(${progress})`;
  }

  /** @param {string} gesture @param {string} [detail] */
  _recordHistory(gesture, detail) {
    if (gesture === this._lastGesture && !detail) return;

    this._lastGesture = gesture;
    this._history.unshift({
      gesture,
      detail,
      time: new Date().toLocaleTimeString("pt-BR"),
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
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Nenhum gesto reconhecido ainda.";
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...this._history.map((entry) => {
      const item = document.createElement("li");
      item.className = "history-entry";
      item.textContent = formatHistoryEntry(entry);
      return item;
    }));
  }

  /** Polite screen-reader message for discrete changes (not continuous motion). */
  _announce(message) {
    const el = this._dom.announcer;
    if (!el) return;
    el.textContent = "";
    requestAnimationFrame(() => { el.textContent = message; });
  }

  _startTelemetry() {
    setInterval(() => {
      const element = this._dom.fps;
      if (element) element.textContent = this._cameraState === "active" ? `FPS: ${this._fps.value}` : "FPS: —";
    }, UI_CONFIG.FPS_UPDATE_INTERVAL_MS);
    this._renderPose();
    setInterval(() => this._renderPose(), UI_CONFIG.POSE_UPDATE_MS);
  }

  _renderPose() {
    if (!this._scene) return;
    const text = formatPose(this._scene.getPose());
    const fields = [
      [this._dom.poseShape, text.shape],
      [this._dom.poseColor, text.color],
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
