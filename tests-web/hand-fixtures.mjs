// Synthetic 21-point MediaPipe hands in normalized image coordinates
// (wrist at the bottom, fingers pointing up).
const WRIST = { x: 0.5, y: 0.9 };
const MCP = {
  thumb: { x: 0.4, y: 0.8 }, index: { x: 0.44, y: 0.65 }, middle: { x: 0.5, y: 0.63 },
  ring: { x: 0.56, y: 0.65 }, pinky: { x: 0.61, y: 0.68 },
};
const EXTENDED_TIP = {
  thumb: { x: 0.3, y: 0.75 }, index: { x: 0.44, y: 0.4 }, middle: { x: 0.5, y: 0.38 },
  ring: { x: 0.57, y: 0.4 }, pinky: { x: 0.63, y: 0.45 },
};
const FOLDED_TIP = {
  thumb: { x: 0.42, y: 0.78 }, index: { x: 0.44, y: 0.73 }, middle: { x: 0.5, y: 0.71 },
  ring: { x: 0.56, y: 0.73 }, pinky: { x: 0.61, y: 0.76 },
};
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const MCP_INDEX = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 };

const mid = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 });

/**
 * @param {Partial<Record<'thumb'|'index'|'middle'|'ring'|'pinky', boolean>>} extended
 * @param {{ offsetX?: number, tips?: Record<string, {x:number,y:number}> }} [opts]
 */
export function makeHand(extended, { offsetX = 0, tips = {} } = {}) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  lm[0] = { ...WRIST, z: 0 };
  for (const finger of FINGERS) {
    const m = MCP_INDEX[finger];
    const tip = tips[finger] ?? (extended[finger] ? EXTENDED_TIP[finger] : FOLDED_TIP[finger]);
    lm[m] = { ...MCP[finger], z: 0 };
    if (finger === 'thumb') {
      lm[3] = mid(MCP.thumb, tip, 0.5);
      lm[4] = { ...tip, z: 0 };
      continue;
    }
    lm[m + 1] = mid(MCP[finger], tip, 0.4);
    lm[m + 2] = mid(MCP[finger], tip, 0.7);
    lm[m + 3] = { ...tip, z: 0 };
  }
  lm[1] = mid(WRIST, MCP.thumb, 0.5);
  return lm.map((p) => ({ ...p, x: p.x + offsetX }));
}

export const POSES = {
  openPalm: () => makeHand({ thumb: true, index: true, middle: true, ring: true, pinky: true }),
  fist: () => makeHand({}),
  vSign: () => makeHand({ index: true, middle: true }, { tips: { index: { x: 0.38, y: 0.4 }, middle: { x: 0.56, y: 0.38 } } }),
  twoFingers: () => makeHand({ index: true, middle: true }, { tips: { index: { x: 0.47, y: 0.4 }, middle: { x: 0.51, y: 0.38 } } }),
  threeFingers: () => makeHand({ index: true, middle: true, ring: true }),
  pinch: () => makeHand({ middle: true, ring: true, pinky: true }, { tips: { thumb: { x: 0.45, y: 0.5 }, index: { x: 0.46, y: 0.51 } } }),
};
