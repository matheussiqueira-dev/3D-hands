/**
 * Browser-Side Gesture Recognition Engine
 * Converts raw MediaPipe landmark arrays into semantic gesture commands.
 * Uses rule-based detection with temporal debouncing to prevent flickering.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
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

/**
 * Real-time gesture recognizer with temporal debouncing.
 * Each gesture has its own private _detect*() method (Single Responsibility).
 *
 * @example
 * const recognizer = new GestureRecognizer();
 * const results    = recognizer.recognize(landmarks);
 * const primary    = recognizer.getPrimaryGesture(results);
 */
export class GestureRecognizer {
  constructor(overrides = {}) {
    this._cfg        = Object.freeze({ ...GESTURE_CONFIG, ...overrides });
    this._holdTimers = new Map();
    this._prevPalmCenter  = null;
    this._prevHandDist    = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  recognize(hand1, hand2 = null) {
    if (!this._isValidHand(hand1)) { this._holdTimers.clear(); this._prevPalmCenter = null; return []; }

    const fingers  = this._getFingerStates(hand1);
    const extCount = Object.values(fingers).filter(Boolean).length;
    const results  = [];

    const palm = this._detectOpenPalm(hand1, fingers, extCount);
    if (palm)  results.push(palm);

    const pinch = this._detectPinch(hand1);
    if (pinch) results.push(pinch);

    const twoFinger = this._detectTwoFingers(hand1, fingers, extCount);
    if (twoFinger)   results.push(twoFinger);

    const fist = this._detectFist(extCount);
    if (fist)  results.push(fist);

    const vSign = this._detectVSign(fingers);
    if (vSign) results.push(vSign);

    const three = this._detectThreeFingers(fingers, extCount);
    if (three) results.push(three);

    if (hand2 && this._isValidHand(hand2)) {
      const dual = this._detectDualHandScale(hand1, hand2);
      if (dual) results.push(dual);
    } else {
      this._prevHandDist = null;
    }

    return results;
  }

  getPrimaryGesture(results) {
    const PRIORITY = ['dual_hands','fist','v_sign','three_fingers','pinch','two_fingers','open_palm'];
    for (const name of PRIORITY) {
      const found = results.find(r => r.name === name && r.active);
      if (found) return found;
    }
    return results.find(r => r.active) ?? null;
  }

  resetTimer(key) { this._holdTimers.delete(key); }

  reset() {
    this._holdTimers.clear();
    this._prevPalmCenter = null;
    this._prevHandDist   = null;
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  _isValidHand(lm) {
    return Array.isArray(lm) && lm.length === 21 &&
      lm.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y));
  }

  // ── Finger State Analysis ───────────────────────────────────────────────────

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

  _isExtended(lm, tipIdx, mcpIdx, wrist) {
    const tipDist = this._dist(lm[tipIdx],  wrist);
    const mcpDist = this._dist(lm[mcpIdx],  wrist);
    return tipDist > mcpDist * this._cfg.FINGER_EXTENDED_RATIO;
  }

  _isThumbExtended(lm) {
    return Math.abs(lm[TIPS.thumb].x - lm[MCPS.thumb].x) > this._cfg.THUMB_EXTENDED_X_DELTA;
  }

  // ── Gesture Detectors ───────────────────────────────────────────────────────

  _detectOpenPalm(lm, fingers, extCount) {
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
    return { name: 'open_palm', active: true, confidence: 0.90, data: { delta, center } };
  }

  _detectPinch(lm) {
    const d = this._dist(lm[TIPS.thumb], lm[TIPS.index]);
    const active = d < this._cfg.PINCH_THRESHOLD;
    return {
      name: 'pinch', active,
      confidence: active ? Math.max(0, 1 - d / this._cfg.PINCH_THRESHOLD) : 0,
      data: { distance: d, center: { x: (lm[TIPS.thumb].x + lm[TIPS.index].x) / 2, y: (lm[TIPS.thumb].y + lm[TIPS.index].y) / 2 } },
    };
  }

  _detectTwoFingers(lm, fingers, extCount) {
    if (!fingers.index || !fingers.middle || extCount > 3) return null;
    const a = lm[TIPS.index], b = lm[TIPS.middle];
    return { name: 'two_fingers', active: true, confidence: 0.85,
      data: { angle: Math.atan2(b.y - a.y, b.x - a.x), spread: this._dist(a, b) } };
  }

  _detectFist(extCount) {
    if (extCount > 1) { this._holdTimers.delete('fist'); return null; }
    const ok = this._checkHold('fist', this._cfg.FIST_HOLD_MS);
    return { name: 'fist', active: ok, confidence: ok ? 1.0 : 0.3, data: null };
  }

  _detectVSign(fingers) {
    if (!fingers.index || !fingers.middle || fingers.ring || fingers.pinky) {
      this._holdTimers.delete('v_sign'); return null;
    }
    const ok = this._checkHold('v_sign', this._cfg.V_SIGN_HOLD_MS);
    return { name: 'v_sign', active: ok, confidence: ok ? 1.0 : 0.5, data: null };
  }

  _detectThreeFingers(fingers, extCount) {
    if (extCount !== this._cfg.MIN_THREE_FINGERS || !fingers.index || !fingers.middle || !fingers.ring) {
      this._holdTimers.delete('three_fingers'); return null;
    }
    const ok = this._checkHold('three_fingers', this._cfg.THREE_FINGER_HOLD_MS);
    return { name: 'three_fingers', active: ok, confidence: ok ? 1.0 : 0.5, data: null };
  }

  _detectDualHandScale(h1, h2) {
    const d = this._dist(this._palmCenter(h1), this._palmCenter(h2));
    const scaleDelta = this._prevHandDist !== null
      ? (Math.abs(d - this._prevHandDist) < this._cfg.SCALE_DEADZONE ? 0 : d - this._prevHandDist)
      : 0;
    this._prevHandDist = d;
    return { name: 'dual_hands', active: true, confidence: 0.95, data: { scaleDelta, handDistance: d } };
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  _dist(a, b)       { return Math.hypot(a.x - b.x, a.y - b.y); }
  _palmCenter(lm)   {
    let sx = 0, sy = 0;
    for (const i of PALM_INDICES) { sx += lm[i].x; sy += lm[i].y; }
    return { x: sx / PALM_INDICES.length, y: sy / PALM_INDICES.length };
  }

  _checkHold(key, durationMs) {
    const now = performance.now();
    if (!this._holdTimers.has(key)) { this._holdTimers.set(key, now); return false; }
    return now - this._holdTimers.get(key) >= durationMs;
  }
}
