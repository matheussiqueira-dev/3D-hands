// Generates public/models/luminaria.glb: an original desk-lamp model built from
// Three.js primitives and exported with GLTFExporter (binary glTF 2.0).
// Usage: node scripts/generate_sample_model.mjs   (uses Playwright + network for the CDN)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const OUT = new URL('../public/models/luminaria.glb', import.meta.url);

const page = `<!doctype html><script type="importmap">${JSON.stringify({
  imports: { three: `${THREE_BASE}build/three.module.js`, 'three/addons/': `${THREE_BASE}examples/jsm/` },
})}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ms-tokens values (assets are on the literal-colour allowlist).
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3, ...extra });
const lamp = new THREE.Group();
lamp.name = 'Luminaria';

const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.12, 48), mat('#646d7d'));
base.name = 'Base';
base.position.y = 0.06;

const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 24), mat('#a3abb8', { metalness: 0.8, roughness: 0.25 }));
stem.name = 'Haste';
stem.position.y = 0.77;

const joint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), mat('#a3abb8', { metalness: 0.8, roughness: 0.25 }));
joint.name = 'Articulacao';
joint.position.y = 1.42;

const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 24), mat('#a3abb8', { metalness: 0.8, roughness: 0.25 }));
arm.name = 'Braco';
arm.rotation.z = -Math.PI / 3;
arm.position.set(0.39, 1.645, 0);

const head = new THREE.Group();
head.name = 'Cupula';
head.position.set(0.78, 1.87, 0);
head.rotation.z = Math.PI / 5;
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 48, 1, true), mat('#f8ba8a', { side: THREE.DoubleSide, metalness: 0.1 }));
shade.name = 'Abajur';
shade.position.y = -0.2;
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), mat('#e4e7ec', { emissive: '#f5c56d', emissiveIntensity: 0.8, metalness: 0 }));
bulb.name = 'Lampada';
bulb.position.y = -0.4;
head.add(shade, bulb);

lamp.add(base, stem, joint, arm, head);

const result = await new GLTFExporter().parseAsync(lamp, { binary: true });
const bytes = new Uint8Array(result);
let binary = '';
for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
window.__glb = btoa(binary);
</script>`;

const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
const tab = await browser.newPage();
await tab.setContent(page);
const b64 = await tab.waitForFunction(() => window.__glb, null, { timeout: 30_000 }).then((h) => h.jsonValue());
await browser.close();

mkdirSync(new URL('.', OUT), { recursive: true });
const glb = Buffer.from(b64, 'base64');
writeFileSync(OUT, glb);
console.log(`wrote ${OUT.pathname} (${glb.length} bytes)`);
