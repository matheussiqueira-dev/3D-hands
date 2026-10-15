import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MODEL_BYTES, MODEL_FILE_MESSAGES, checkModelFile, modelDisplayName } from '../public/js/model-file.js';

/** 12-byte GLB header. */
function header({ magic = 0x46546c67, version = 2, length = 1000 } = {}) {
  const buf = new ArrayBuffer(12);
  const v = new DataView(buf);
  v.setUint32(0, magic, true);
  v.setUint32(4, version, true);
  v.setUint32(8, length, true);
  return buf;
}

test('a well-formed GLB passes', () => {
  assert.deepEqual(checkModelFile({ name: 'cadeira.GLB', size: 1000 }, header()), { ok: true });
});

test('wrong extension, empty, oversized and non-GLB files are rejected with a reason', () => {
  assert.deepEqual(checkModelFile({ name: 'modelo.gltf', size: 1000 }, header()), { ok: false, problem: 'type' });
  assert.deepEqual(checkModelFile({ name: 'vazio.glb', size: 0 }, header({ length: 0 })), { ok: false, problem: 'empty' });
  assert.deepEqual(checkModelFile({ name: 'grande.glb', size: MAX_MODEL_BYTES + 1 }, header({ length: MAX_MODEL_BYTES + 1 })), { ok: false, problem: 'size' });
  assert.deepEqual(checkModelFile({ name: 'texto.glb', size: 1000 }, header({ magic: 0x6c6c6568 })), { ok: false, problem: 'format' });
  assert.deepEqual(checkModelFile({ name: 'v1.glb', size: 1000 }, header({ version: 1 })), { ok: false, problem: 'format' });
  assert.deepEqual(checkModelFile({ name: 'truncado.glb', size: 1000 }, header({ length: 2000 })), { ok: false, problem: 'format' });
  assert.deepEqual(checkModelFile({ name: 'curto.glb', size: 8 }, new ArrayBuffer(8)), { ok: false, problem: 'format' });
});

test('every problem has a PT-BR message', () => {
  for (const problem of ['type', 'size', 'format', 'empty']) assert.ok(MODEL_FILE_MESSAGES[problem].length > 10);
  assert.match(MODEL_FILE_MESSAGES.size, /25 MB/);
});

test('display names drop folders and stay short', () => {
  assert.equal(modelDisplayName('C:\\modelos\\cadeira.glb'), 'cadeira.glb');
  assert.equal(modelDisplayName('pasta/sub/mesa.glb'), 'mesa.glb');
  assert.equal(modelDisplayName('a'.repeat(40) + '.glb').length, 30);
});
