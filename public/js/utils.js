/**
 * Shared runtime utilities: FPS measurement, landmark smoothing and timeouts.
 * Pure modules (no DOM access) so they run under `node --test`.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 * @module  utils
 */

/** @typedef {{ x: number, y: number, z?: number }} Point */
/** @typedef {{ landmarks: Point[], handedness: string }} TrackedHand */

/**
 * Rolling-window FPS counter.
 * @example const fps = new FPSCounter(); fps.tick(); console.log(fps.value);
 */
export class FPSCounter {
  /**
   * @param {number} [windowSize=60] number of recent frames averaged
   * @param {() => number} [now] clock in milliseconds (injectable for tests)
   */
  constructor(windowSize = 60, now = () => performance.now()) {
    /** @type {number[]} */
    this._timestamps = [];
    this._windowSize = windowSize;
    this._now = now;
    this.value = 0;
  }

  tick() {
    const now = this._now();
    this._timestamps.push(now);
    if (this._timestamps.length > this._windowSize) this._timestamps.shift();
    const count = this._timestamps.length;
    if (count >= 2) {
      const elapsed = (now - this._timestamps[0]) / 1000;
      this.value = elapsed > 0 ? Math.round((count - 1) / elapsed) : 0;
    }
  }

  reset() {
    this._timestamps = [];
    this.value = 0;
  }
}

/**
 * Exponential moving average over the 21 landmarks of each hand, keyed by
 * handedness so two hands never blend when MediaPipe reorders them. A hand
 * that jumps farther than `jumpThreshold` (normalized units) in one frame is
 * treated as new and snaps instead of sliding across the image.
 */
export class LandmarkSmoother {
  /** @param {{ alpha?: number, jumpThreshold?: number }} [options] alpha = weight of the newest frame, in (0, 1] */
  constructor({ alpha = 0.5, jumpThreshold = 0.15 } = {}) {
    if (!(alpha > 0 && alpha <= 1)) throw new RangeError('alpha must be in (0, 1]');
    this._alpha = alpha;
    this._jump = jumpThreshold;
    /** @type {Map<string, Point[]>} */
    this._state = new Map();
  }

  /**
   * @template {TrackedHand} H
   * @param {H[]} hands
   * @returns {H[]} same order and fields, smoothed landmarks
   */
  smooth(hands) {
    /** @type {Map<string, Point[]>} */
    const next = new Map();
    const out = hands.map((hand, index) => {
      const key = next.has(hand.handedness) ? `${hand.handedness}#${index}` : hand.handedness;
      const prev = this._state.get(key);
      const landmarks = prev && prev.length === hand.landmarks.length && !this._jumped(prev, hand.landmarks)
        ? hand.landmarks.map((p, i) => this._blend(prev[i], p))
        : hand.landmarks.map((p) => ({ ...p }));
      next.set(key, landmarks);
      return { ...hand, landmarks };
    });
    this._state = next;
    return out;
  }

  reset() {
    this._state.clear();
  }

  /** @param {Point} prev @param {Point} p @returns {Point} */
  _blend(prev, p) {
    const a = this._alpha;
    return {
      x: prev.x + (p.x - prev.x) * a,
      y: prev.y + (p.y - prev.y) * a,
      z: (prev.z ?? 0) + ((p.z ?? 0) - (prev.z ?? 0)) * a,
    };
  }

  /** @param {Point[]} prev @param {Point[]} curr wrist moved too far to be the same hand */
  _jumped(prev, curr) {
    return Math.hypot(curr[0].x - prev[0].x, curr[0].y - prev[0].y) > this._jump;
  }
}

/**
 * Rejects with `makeError()` if `promise` does not settle within `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {() => Error} makeError
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, makeError) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(makeError()), ms);
  });
  return /** @type {Promise<T>} */ (Promise.race([promise, timeout])).finally(() => clearTimeout(timer));
}
