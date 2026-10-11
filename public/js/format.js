/**
 * Pure PT-BR formatting helpers shared by the UI (no DOM access).
 * @module format
 */

const seconds = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** @param {number} ms @returns {string} e.g. "segure 0,8 s" */
export function formatHold(ms) {
  return `segure ${seconds.format(ms / 1000)} s`;
}

/**
 * One guide line: "Punho fechado · segure 2 s · redefine o objeto".
 * @param {{ label: string, holdMs: number, action: string }} entry
 */
export function formatGestureLine(entry) {
  return [entry.label, entry.holdMs > 0 ? formatHold(entry.holdMs) : null, entry.action]
    .filter(Boolean)
    .join(' · ');
}
