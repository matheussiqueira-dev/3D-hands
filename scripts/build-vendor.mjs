// Build step: self-hosts the third-party code the page uses (ADR-0003).
//
// 1. Bundles, tree-shakes and minifies into public/vendor/ (content-hashed ES modules):
//    - `three`: only the THREE.* names the app references;
//    - `three/addons/loaders/GLTFLoader.js`: imported lazily, shares the three chunk;
//    - `vendor/hand-landmarker`: FilesetResolver + HandLandmarker from
//      @mediapipe/tasks-vision, plus the URLs of the WASM and of the model.
// 2. Copies the tasks-vision WASM (SIMD and no-SIMD) and models/mediapipe/hand_landmarker.task.
// 3. Writes the import map into public/index.html and its CSP hash into vercel.json.
//    With --check, or on CI/Vercel, it only verifies them: Vercel reads vercel.json
//    before the build, so the committed CSP must already match what is served.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VENDOR_DIR = `${ROOT}public/vendor`;
const INDEX_HTML = `${ROOT}public/index.html`;
const VERCEL_JSON = `${ROOT}vercel.json`;
const MODEL_SOURCE = `${ROOT}models/mediapipe/hand_landmarker.task`;
const WASM_SOURCE = `${ROOT}node_modules/@mediapipe/tasks-vision/wasm`;
// FilesetResolver.forVisionTasks(base) picks one of these pairs (SIMD when the browser supports it).
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
const IMPORT_MAP_RE = /(<script type="importmap">)([^<]*)(<\/script>)/;
const CSP_HASH_RE = /'sha256-[A-Za-z0-9+/=]+'/;

const verifyOnly = process.argv.includes('--check') || Boolean(process.env.CI || process.env.VERCEL);

/** @param {string} file */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
/** @param {string | Buffer} data */
const shortHash = (data) => createHash('sha256').update(data).digest('hex').slice(0, 12);

/** Every `THREE.Name` the app's modules reference that `three` actually exports (JSDoc types included). */
async function usedThreeExports() {
  const exported = new Set(Object.keys(await import('three')));
  const names = new Set();
  for (const file of readdirSync(`${ROOT}public/js`)) {
    if (!file.endsWith('.js')) continue;
    const source = readFileSync(`${ROOT}public/js/${file}`, 'utf8');
    for (const [, name] of source.matchAll(/\bTHREE\.([A-Za-z_$][\w$]*)/g)) if (exported.has(name)) names.add(name);
  }
  if (names.size === 0) throw new Error('no THREE.* references found in public/js');
  return [...names].sort();
}

function copyAssets() {
  const { version } = readJson(`${ROOT}node_modules/@mediapipe/tasks-vision/package.json`);
  const wasmDir = `tasks-vision-${version}`;
  mkdirSync(`${VENDOR_DIR}/${wasmDir}`, { recursive: true });
  for (const file of WASM_FILES) copyFileSync(`${WASM_SOURCE}/${file}`, `${VENDOR_DIR}/${wasmDir}/${file}`);
  const model = readFileSync(MODEL_SOURCE);
  const modelFile = `hand_landmarker-${shortHash(model)}.task`;
  writeFileSync(`${VENDOR_DIR}/${modelFile}`, model);
  return { wasmBaseUrl: `/vendor/${wasmDir}`, modelUrl: `/vendor/${modelFile}` };
}

/**
 * @param {string[]} threeNames
 * @param {{ wasmBaseUrl: string, modelUrl: string }} assets
 * @returns {Promise<Record<string, string>>} import-map specifier → published URL
 */
async function bundle(threeNames, assets) {
  /** @type {Record<string, { specifier: string, contents: string }>} */
  const entries = {
    three: { specifier: 'three', contents: `export { ${threeNames.join(', ')} } from 'three';` },
    'three-gltf-loader': {
      specifier: 'three/addons/loaders/GLTFLoader.js',
      contents: `export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`,
    },
    'hand-landmarker': {
      specifier: 'vendor/hand-landmarker',
      contents: [
        `export { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';`,
        `export const WASM_BASE_URL = ${JSON.stringify(assets.wasmBaseUrl)};`,
        `export const MODEL_URL = ${JSON.stringify(assets.modelUrl)};`,
      ].join('\n'),
    },
  };
  const result = await build({
    entryPoints: Object.keys(entries).map((name) => ({ in: `vendor-entry:${name}`, out: name })),
    outdir: VENDOR_DIR,
    entryNames: '[name]-[hash]',
    chunkNames: 'chunk-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'eof',
    metafile: true,
    logLevel: 'warning',
    plugins: [{
      name: 'vendor-entries',
      setup(b) {
        b.onResolve({ filter: /^vendor-entry:/ }, (args) => ({ path: args.path.slice('vendor-entry:'.length), namespace: 'vendor-entry' }));
        b.onLoad({ filter: /.*/, namespace: 'vendor-entry' }, (args) => ({ contents: entries[args.path].contents, resolveDir: ROOT, loader: 'js' }));
      },
    }],
  });
  /** @type {Record<string, string>} */
  const imports = {};
  for (const [file, output] of Object.entries(result.metafile.outputs)) {
    const name = output.entryPoint?.replace(/^vendor-entry:/, '');
    if (name && entries[name]) imports[entries[name].specifier] = `/vendor/${file.split('/').pop()}`;
  }
  // Fixed order so the inline import map, and therefore its CSP hash, is stable.
  return Object.fromEntries(Object.values(entries).map(({ specifier }) => [specifier, imports[specifier]]));
}

/** @param {Record<string, string>} imports */
function syncPage(imports) {
  const importMap = JSON.stringify({ imports });
  const cspHash = `'sha256-${createHash('sha256').update(importMap).digest('base64')}'`;
  const html = readFileSync(INDEX_HTML, 'utf8');
  const vercel = readFileSync(VERCEL_JSON, 'utf8');
  if (!IMPORT_MAP_RE.test(html)) throw new Error('public/index.html has no <script type="importmap">');
  if (!CSP_HASH_RE.test(vercel)) throw new Error("vercel.json CSP has no 'sha256-…' source");
  const nextHtml = html.replace(IMPORT_MAP_RE, (_, open, _old, close) => open + importMap + close);
  const nextVercel = vercel.replace(CSP_HASH_RE, cspHash);
  const stale = [nextHtml !== html && 'public/index.html', nextVercel !== vercel && 'vercel.json'].filter(Boolean);
  if (stale.length === 0) return;
  if (verifyOnly) {
    throw new Error(`${stale.join(' and ')} out of date with the vendor build. Run "npm run build" locally and commit the result.`);
  }
  writeFileSync(INDEX_HTML, nextHtml);
  writeFileSync(VERCEL_JSON, nextVercel);
  console.log('[build-vendor] updated', stale.join(', '));
}

try {
  rmSync(VENDOR_DIR, { recursive: true, force: true }); // generated, never committed
  mkdirSync(VENDOR_DIR, { recursive: true });
  const assets = copyAssets();
  const imports = await bundle(await usedThreeExports(), assets);
  syncPage(imports);
  console.log('[build-vendor]', imports);
} catch (err) {
  console.error('[build-vendor] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
