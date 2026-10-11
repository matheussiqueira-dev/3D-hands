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

const KEYBOARD_HINT = 'Use as setas, N, C, R e +/− para controlar o objeto.';

/** User-facing PT-BR message for a CameraError code (see hand-tracker.js). */
export const CAMERA_ERROR_MESSAGES = Object.freeze({
  denied: 'A câmera foi bloqueada. Libere o acesso no cadeado da barra de endereço e clique em Tentar novamente.',
  'not-found': `Nenhuma câmera encontrada. ${KEYBOARD_HINT}`,
  'in-use': 'A câmera está sendo usada por outro aplicativo. Feche esse aplicativo e clique em Tentar novamente.',
  unsupported: `Este navegador não permite usar a câmera nesta página. ${KEYBOARD_HINT}`,
  model: 'Não foi possível carregar o modelo de mãos. Verifique a conexão e clique em Tentar novamente.',
  unknown: 'Não foi possível iniciar a câmera. Clique em Tentar novamente.',
});

/** @param {string | undefined} code */
export function cameraErrorMessage(code) {
  return CAMERA_ERROR_MESSAGES[code] ?? CAMERA_ERROR_MESSAGES.unknown;
}
