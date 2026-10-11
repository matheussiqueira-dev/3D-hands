/**
 * Line icons from Lucide v1.55.0 (lucide-static, ISC license), stored as data
 * so they can be built with DOM APIs (no innerHTML).
 * @module icons
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @type {Record<string, Array<[string, Record<string, string>]>>} */
const ICONS = Object.freeze({
  'move': [["path", {"d": "M12 2v20"}], ["path", {"d": "m15 19-3 3-3-3"}], ["path", {"d": "m19 9 3 3-3 3"}], ["path", {"d": "M2 12h20"}], ["path", {"d": "m5 9-3 3 3 3"}], ["path", {"d": "m9 5 3-3 3 3"}]],
  'zoom-in': [["circle", {"cx": "11", "cy": "11", "r": "8"}], ["line", {"x1": "21", "x2": "16.65", "y1": "21", "y2": "16.65"}], ["line", {"x1": "11", "x2": "11", "y1": "8", "y2": "14"}], ["line", {"x1": "8", "x2": "14", "y1": "11", "y2": "11"}]],
  'rotate-3d': [["path", {"d": "m15.194 13.707 3.814 1.86-1.86 3.814"}], ["path", {"d": "M16.47214 7.52786 A 5 10 0 1 0 13 21.79796"}], ["path", {"d": "M21.79796 11 A 10 5 0 1 0 19 15.57071"}]],
  'rotate-ccw': [["path", {"d": "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}], ["path", {"d": "M3 3v5h5"}]],
  'shapes': [["path", {"d": "M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"}], ["rect", {"x": "3", "y": "14", "width": "7", "height": "7", "rx": "1"}], ["circle", {"cx": "17.5", "cy": "17.5", "r": "3.5"}]],
  'palette': [["path", {"d": "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"}], ["circle", {"cx": "13.5", "cy": "6.5", "r": ".5", "fill": "currentColor"}], ["circle", {"cx": "17.5", "cy": "10.5", "r": ".5", "fill": "currentColor"}], ["circle", {"cx": "6.5", "cy": "12.5", "r": ".5", "fill": "currentColor"}], ["circle", {"cx": "8.5", "cy": "7.5", "r": ".5", "fill": "currentColor"}]],
  'scaling': [["path", {"d": "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"}], ["path", {"d": "M14 15H9v-5"}], ["path", {"d": "M16 3h5v5"}], ["path", {"d": "M21 3 9 15"}]],
});

/**
 * @param {string} name Lucide icon name
 * @param {number} [size=20]
 * @returns {SVGSVGElement}
 */
export function createIcon(name, size = 20) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs = {
    width: String(size), height: String(size), viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
  };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
  for (const [tag, props] of ICONS[name] ?? []) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(props)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}
