/**
 * Browser-Side Gesture Recognition Engine
 * Converts raw MediaPipe landmark arrays into semantic gesture commands.
 * Uses rule-based detection with temporal debouncing to prevent flickering.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 * @module  gesture-recognizer
 */

import { GESTURE_CONFIG } from './config.js';

/** MediaPipe fingertip landmark indices */
const TIPS = Object.freeze({ thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 });
/** MediaPipe MCP (knuckle) landmark indices */
const MCPS = Object.freeze({ thumb: 2, index: 5, middle: 9,  ring: 13, pinky: 17 });
/** Palm landmark indices used to compute palm centroid */
const PALM_INDICES = Object.freeze([0, 1, 5, 9, 13, 17]);
const WRIST = 0;

/** @typedef {{ x: number, y: number, z?: number }} Point */
/** @typedef {Point[]} Hand 21 MediaPipe landmarks in normalized image coordinates */
/** @typedef {{ thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean }} FingerStates */
/** @typedef {'fist' | 'v_sign' | 'three_fingers'} HoldGestureName */
/**
 * @typedef {{ name: 'open_palm', active: boolean, data: { delta: Point, center: Point } }
 *   | { name: 'pinch', active: boolean, data: { distance: number, center: Point } }
 *   | { name: 'two_fingers', active: boolean, data: { angle: number, spread: number } }
 *   | { name: 'dual_hands', active: boolean, data: { scaleDelta: number, handDistance: number } }
 *   | { name: HoldGestureName, active: boolean, progress: number, holdMs: number, data: null }} GestureResult
 */
/** @typedef {GestureResult['name']} GestureName */

/** Gesture names this recognizer can emit, highest priority first. @type {readonly GestureName[]} */
export const GESTURE_NAMES = Object.freeze(['dual_hands', 'fist', 'v_sign', 'three_fingers', 'pinch', 'two_fingers', 'open_palm']);

/** Single-hand gestures that act on every frame (no hold time). */
/** @type {ReadonlySet<GestureName>} */
const CONTINUOUS = new Set(['open_palm', 'pinch', 'two_fingers']);

/**
 * Real-time gesture recognizer with temporal debouncing.
 * Each gesture has its own private _detect*() method (Single Responsibility).
 *
 * @example
 * const recognizer = new GestureRecognizer();
 * const results    = recognizer.recognize(landmarks);
 * const primary    = recognizer.getPrimaryGesture(results);
 *
 * Hold gestures (fist, v_sign, three_fingers) report `progress` from 0 to 1:
 * the measured fraction of their hold time, not a detection confidence.
 * A hold fires (`active: true`) on exactly one frame; the pose must be
 * released before the same gesture can fire again.
 */
export class GestureRecognizer {
  /**
   * @param {Partial<typeof GESTURE_CONFIG>} [overrides]
   * @param {{ now?: () => number }} [deps] clock in milliseconds (injectable for tests)
   */
  constructor(overrides = {}, { now = () => performance.now() } = {}) {
    this._cfg        = Object.freeze({ ...GESTURE_CONFIG, ...overrides });
    this._now        = now;
    /** @type {Map<HoldGestureName, number>} hold start time per gesture */
    this._holdTimers = new Map();
    /** @type {Set<HoldGestureName>} holds that already fired and await release */
    this._firedHolds = new Set();
    /** @type {Point | null} */
    this._prevPalmCenter  = null;
    /** @type {number | null} */
    this._prevHandDist    = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * @param {unknown} hand1 landmarks of the first hand (validated here)
   * @param {unknown} [hand2] landmarks of the second hand, if any
   * @returns {GestureResult[]}
   */
  recognize(hand1, hand2 = null) {
    if (!this._isValidHand(hand1)) { this._clearHolds(); this._prevPalmCenter = null; return []; }

    const fingers  = this._getFingerStates(hand1);
    const extCount = Object.values(fingers).filter(Boolean).length;
    /** @type {GestureResult[]} */
    const results  = [];

    const palm = this._detectOpenPalm(hand1, extCount);
    if (palm)  results.push(palm);

    const pinch = this._detectPinch(hand1);
    if (pinch) results.push(pinch);

    const twoFinger = this._detectTwoFingers(hand1, fingers);
    if (twoFinger)   results.push(twoFinger);

    const fist = this._detectFist(extCount);
    if (fist)  results.push(fist);

    const vSign = this._detectVSign(hand1, fingers);
    if (vSign) results.push(vSign);

    const three = this._detectThreeFingers(fingers, extCount);
    if (three) results.push(three);

    // A pose being held for a timed command must not also move the object.
    if (fist || vSign || three) {
      for (const r of results) if (CONTINUOUS.has(r.name)) r.active = false;
    }

    if (hand2 && this._isValidHand(hand2)) {
      const dual = this._detectDualHandScale(hand1, hand2);
      if (dual) results.push(dual);
    } else {
      this._prevHandDist = null;
    }

    return results;
  }

  /** @param {GestureResult[]} results @returns {GestureResult | null} highest-priority active gesture */
  getPrimaryGesture(results) {
    for (const name of GESTURE_NAMES) {
      const found = results.find(r => r.name === name && r.active);
      if (found) return found;
    }
    return results.find(r => r.active) ?? null;
  }

  reset() {
    this._clearHolds();
    this._prevPalmCenter = null;
    this._prevHandDist   = null;
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  /** @param {unknown} lm @returns {lm is Hand} */
  _isValidHand(lm) {
    return Array.isArray(lm) && lm.length === 21 &&
      lm.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y));
  }

  // ── Finger State Analysis ───────────────────────────────────────────────────

  /** @param {Hand} lm @returns {FingerStates} */
  _getFingerStates(lm) {
    const wrist = lm[WRIST];
    return {
      thumb:  this._isThumbExtended(lm),
      index:  this._isExtended(lm, TIPS.index,  MCPS.index,  wrist),
      middle: this._isExtended(lm, TIPS.middle, MCPS.middle, wrist),
      ring:   this._isExtended(lm, TIPS.ring,   MCPS.ring,   wrist),
      pinky:  this._isExtended(lm, TIPS.pinky,  MCPS.pinky,  wrist),
    };
  }

  /** @param {Hand} lm @param {number} tipIdx @param {number} mcpIdx @param {Point} wrist */
  _isExtended(lm, tipIdx, mcpIdx, wrist) {
    const tipDist = this._dist(lm[tipIdx],  wrist);
    const mcpDist = this._dist(lm[mcpIdx],  wrist);
    return tipDist > mcpDist * this._cfg.FINGER_EXTENDED_RATIO;
  }

  /** @param {Hand} lm */
  _isThumbExtended(lm) {
    return Math.abs(lm[TIPS.thumb].x - lm[MCPS.thumb].x) > this._cfg.THUMB_EXTENDED_X_DELTA;
  }

  // ── Gesture Detectors ───────────────────────────────────────────────────────

  /** @param {Hand} lm @param {number} extCount @returns {GestureResult | null} */
  _detectOpenPalm(lm, extCount) {
    if (extCount < this._cfg.MIN_OPEN_FINGERS) { this._prevPalmCenter = null; return null; }
    const center = this._palmCenter(lm);
    const delta  = { x: 0, y: 0 };
    if (this._prevPalmCenter) {
      delta.x = center.x - this._prevPalmCenter.x;
      delta.y = center.y - this._prevPalmCenter.y;
      if (Math.abs(delta.x) < this._cfg.TRANSLATION_DEADZONE) delta.x = 0;
      if (Math.abs(delta.y) < this._cfg.TRANSLATION_DEADZONE) delta.y = 0;
    }
    this._prevPalmCenter = center;
    return { name: 'open_palm', active: true, data: { delta, center } };
  }

  /** @param {Hand} lm @returns {GestureResult} */
  _detectPinch(lm) {
    const d = this._dist(lm[TIPS.thumb], lm[TIPS.index]);
    const active = d < this._cfg.PINCH_THRESHOLD;
    return {
      name: 'pinch', active,
      data: { distance: d, center: { x: (lm[TIPS.thumb].x + lm[TIPS.index].x) / 2, y: (lm[TIPS.thumb].y + lm[TIPS.index].y) / 2 } },
    };
  }

  /** Index and middle up, ring and pinky down; the thumb is ignored. @param {FingerStates} fingers */
  _isTwoFingerPose(fingers) {
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
  }

  /** Gap between index and middle tips relative to the palm length. @param {Hand} lm */
  _fingerSpreadRatio(lm) {
    const palm = this._dist(lm[WRIST], lm[MCPS.middle]);
    return palm > 0 ? this._dist(lm[TIPS.index], lm[TIPS.middle]) / palm : 0;
  }

  /** @param {Hand} lm @param {FingerStates} fingers @returns {GestureResult | null} */
  _detectTwoFingers(lm, fingers) {
    if (!this._isTwoFingerPose(fingers) || this._fingerSpreadRatio(lm) >= this._cfg.V_SIGN_MIN_SPREAD_RATIO) return null;
    const a = lm[TIPS.index], b = lm[TIPS.middle];
    return { name: 'two_fingers', active: true,
      data: { angle: Math.atan2(b.y - a.y, b.x - a.x), spread: this._dist(a, b) } };
  }

  /** @param {number} extCount @returns {GestureResult | null} */
  _detectFist(extCount) {
    if (extCount > 1) { this._releaseHold('fist'); return null; }
    return this._holdResult('fist', this._cfg.FIST_HOLD_MS);
  }

  /** @param {Hand} lm @param {FingerStates} fingers @returns {GestureResult | null} */
  _detectVSign(lm, fingers) {
    if (!this._isTwoFingerPose(fingers) || this._fingerSpreadRatio(lm) < this._cfg.V_SIGN_MIN_SPREAD_RATIO) {
      this._releaseHold('v_sign'); return null;
    }
    return this._holdResult('v_sign', this._cfg.V_SIGN_HOLD_MS);
  }

  /** @param {FingerStates} fingers @param {number} extCount @returns {GestureResult | null} */
  _detectThreeFingers(fingers, extCount) {
    if (extCount !== this._cfg.MIN_THREE_FINGERS || !fingers.index || !fingers.middle || !fingers.ring) {
      this._releaseHold('three_fingers'); return null;
    }
    return this._holdResult('three_fingers', this._cfg.THREE_FINGER_HOLD_MS);
  }

  /** @param {Hand} h1 @param {Hand} h2 @returns {GestureResult} */
  _detectDualHandScale(h1, h2) {
    const d = this._dist(this._palmCenter(h1), this._palmCenter(h2));
    const scaleDelta = this._prevHandDist !== null
      ? (Math.abs(d - this._prevHandDist) < this._cfg.SCALE_DEADZONE ? 0 : d - this._prevHandDist)
      : 0;
    this._prevHandDist = d;
    return { name: 'dual_hands', active: true, data: { scaleDelta, handDistance: d } };
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  /** @param {Point} a @param {Point} b */
  _dist(a, b)       { return Math.hypot(a.x - b.x, a.y - b.y); }
  /** @param {Hand} lm @returns {Point} */
  _palmCenter(lm)   {
    let sx = 0, sy = 0;
    for (const i of PALM_INDICES) { sx += lm[i].x; sy += lm[i].y; }
    return { x: sx / PALM_INDICES.length, y: sy / PALM_INDICES.length };
  }

  /**
   * Starts or continues the hold timer for `key` and reports its progress.
   * @param {HoldGestureName} key @param {number} durationMs @returns {GestureResult}
   */
  _holdResult(key, durationMs) {
    const now = this._now();
    const start = this._holdTimers.get(key) ?? now;
    this._holdTimers.set(key, start);
    const progress = Math.min(1, (now - start) / durationMs);
    const fires = progress >= 1 && !this._firedHolds.has(key);
    if (fires) this._firedHolds.add(key);
    return { name: key, active: fires, progress, holdMs: durationMs, data: null };
  }

  /** @param {HoldGestureName} key */
  _releaseHold(key) {
    this._holdTimers.delete(key);
    this._firedHolds.delete(key);
  }

  _clearHolds() {
    this._holdTimers.clear();
    this._firedHolds.clear();
  }
}
