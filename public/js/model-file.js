/**
 * Validation of user-supplied 3D model files before they reach the parser.
 * Pure (no DOM), so every rule is unit-tested.
 * @module model-file
 */

/** Largest model accepted, in bytes. Files are parsed in memory on the main thread. */
export const MAX_MODEL_BYTES = 25 * 1024 * 1024;

/** @typedef {'type' | 'size' | 'format' | 'empty'} ModelFileProblem */
/** @typedef {{ ok: true } | { ok: false, problem: ModelFileProblem }} ModelFileCheck */

/** @type {Readonly<Record<ModelFileProblem, string>>} */
export const MODEL_FILE_MESSAGES = Object.freeze({
  type: 'Escolha um arquivo .glb (glTF binário).',
  size: `O arquivo passa de ${MAX_MODEL_BYTES / 1024 / 1024} MB. Use um modelo menor.`,
  format: 'Este arquivo não é um glTF binário válido (versão 2).',
  empty: 'O arquivo está vazio.',
});

/**
 * Checks name, size and the 12-byte GLB header ("glTF", version 2, total length).
 * @param {{ name: string, size: number }} file
 * @param {ArrayBuffer} header at least the first 12 bytes of the file
 * @returns {ModelFileCheck}
 */
export function checkModelFile(file, header) {
  if (!/\.glb$/i.test(file.name)) return { ok: false, problem: 'type' };
  if (file.size === 0) return { ok: false, problem: 'empty' };
  if (file.size > MAX_MODEL_BYTES) return { ok: false, problem: 'size' };
  if (header.byteLength < 12) return { ok: false, problem: 'format' };
  const view = new DataView(header);
  const magic = view.getUint32(0, true);   // ASCII "glTF"
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  if (magic !== 0x46546c67 || version !== 2 || length !== file.size) return { ok: false, problem: 'format' };
  return { ok: true };
}

/** Display name without folders, trimmed to keep the pose readout short. @param {string} name */
export function modelDisplayName(name) {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.length > 32 ? `${base.slice(0, 29)}…` : base;
}
