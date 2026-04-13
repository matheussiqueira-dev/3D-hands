/**
 * Shared Utility Library — Math, FPS, Smoothing
 * Pure utility functions with no side effects.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 * @module  utils
 */

/** @param {{x:number,y:number,z?:number}} a @param {{x:number,y:number,z?:number}} b @returns {number} */
export function calculateDistance(a, b) {
  if (!a || !b) return 0;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + dz ** 2);
}

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b @returns {number} */
export function calculateAngle(a, b) {
  if (!a || !b) return 0;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Linear interpolation. @param {number} a @param {number} b @param {number} t @returns {number} */
export function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

/** @param {number} value @param {number} min @param {number} max @returns {number} */
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/** @param {number} value @param {number} inMin @param {number} inMax @param {number} outMin @param {number} outMax */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMin === inMax) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Generates a cryptographically-random alphanumeric ID. @param {number} [length=16] @returns {string} */
export function generateSessionId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

/**
 * Rolling-window FPS counter.
 * @example const fps = new FPSCounter(); fps.tick(); console.log(fps.value);
 */
export class FPSCounter {
  constructor(windowSize = 60) {
    if (windowSize < 2) throw new RangeError('FPSCounter windowSize must be >= 2');
    this._timestamps = [];
    this._windowSize = windowSize;
    this.value = 0;
  }
  tick() {
    const now = performance.now();
    this._timestamps.push(now);
    if (this._timestamps.length > this._windowSize) this._timestamps.shift();
    const count = this._timestamps.length;
    if (count >= 2) {
      const elapsed = (now - this._timestamps[0]) / 1000;
      this.value = elapsed > 0 ? Math.round((count - 1) / elapsed) : 0;
    }
  }
  reset() { this._timestamps = []; this.value = 0; }
}

/**
 * Exponential moving average smoother for scalars.
 * @example const s = new Smoother(0.3); const out = s.update(rawValue);
 */
export class Smoother {
  constructor(alpha = 0.3) {
    if (alpha <= 0 || alpha >= 1) throw new RangeError('Smoother alpha must be in (0, 1)');
    this._alpha = alpha;
    this._value = null;
  }
  update(sample) {
    if (typeof sample !== 'number' || !isFinite(sample)) return this._value ?? 0;
    this._value = this._value === null ? sample : lerp(this._value, sample, this._alpha);
    return this._value;
  }
  get value() { return this._value ?? 0; }
  reset() { this._value = null; }
}

/** Exponential smoother for {x,y,z} vector objects. */
export class VectorSmoother {
  constructor(alpha = 0.35) { this._alpha = alpha; this._value = null; }
  update(vec) {
    if (!vec || typeof vec !== 'object') return this._value ?? {};
    if (this._value === null) { this._value = { ...vec }; }
    else {
      for (const key of Object.keys(vec)) {
        if (typeof vec[key] === 'number' && isFinite(vec[key]))
          this._value[key] = lerp(this._value[key] ?? vec[key], vec[key], this._alpha);
      }
    }
    return { ...this._value };
  }
  reset() { this._value = null; }
}

/** Debounce: delays invocation by waitMs. */
export function debounce(fn, waitMs) {
  let timer = null;
  return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), waitMs); };
}

/** Throttle: fires fn at most once per intervalMs. */
export function throttle(fn, intervalMs) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= intervalMs) { lastCall = now; return fn.apply(this, args); }
  };
}
