import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SAMPLE = readFileSync(new URL('../public/models/luminaria.glb', import.meta.url));

test('the sample model loads, replaces the shape and keeps its own colours', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.getByRole('button', { name: 'Usar luminária de exemplo' }).click();
  await expect(page.locator('#model-status')).toContainText('Modelo carregado: luminaria.glb');
  await expect(page.locator('#object-type')).toHaveText('Modelo: luminaria.glb');
  await expect(page.locator('#object-color')).toHaveText('Originais do modelo');
  await page.keyboard.press('c');
  await expect(page.locator('#announcer')).toHaveText('Modelos próprios mantêm as cores originais.');
  // N cycles back to the built-in shapes and the model stays available.
  await page.keyboard.press('n');
  await expect(page.locator('#object-type')).toHaveText('Cubo');
  expect(errors).toEqual([]);
});

test('a user file chosen in the picker is parsed in the browser, without uploading it', async ({ page }) => {
  const uploads = [];
  page.on('request', (req) => { if (req.method() !== 'GET') uploads.push(req.url()); });
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.locator('#model-input').setInputFiles({ name: 'cadeira.glb', mimeType: 'model/gltf-binary', buffer: SAMPLE });
  await expect(page.locator('#object-type')).toHaveText('Modelo: cadeira.glb');
  expect(uploads).toEqual([]);
});

test('a file that is not a GLB is rejected with a PT-BR message', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.locator('#model-input').setInputFiles({ name: 'falso.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('isto não é um modelo 3D') });
  await expect(page.locator('#model-error')).toHaveText('Este arquivo não é um glTF binário válido (versão 2).');
  await page.locator('#model-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await expect(page.locator('#model-error')).toHaveText('Escolha um arquivo .glb (glTF binário).');
  await expect(page.locator('#object-type')).toHaveText('Cubo');
});

test('a dropped GLB on the stage is loaded', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  const data = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'arrastado.glb', { type: 'model/gltf-binary' }));
    return dt;
  }, SAMPLE.toString('base64'));
  await page.dispatchEvent('.stage', 'dragenter', { dataTransfer: data });
  await expect(page.locator('#drop-hint')).toBeVisible();
  await page.dispatchEvent('.stage', 'drop', { dataTransfer: data });
  await expect(page.locator('#drop-hint')).toBeHidden();
  await expect(page.locator('#object-type')).toHaveText('Modelo: arrastado.glb');
});

test('a file dropped outside the stage is ignored instead of opened by the browser', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  const url = page.url();
  const notCancelled = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(12)], 'fora.glb', { type: 'model/gltf-binary' }));
    const target = document.querySelector('footer');
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    // dispatchEvent returns false only when a listener called preventDefault().
    return [target.dispatchEvent(over), target.dispatchEvent(drop)];
  });
  expect(notCancelled).toEqual([false, false]);
  expect(page.url()).toBe(url);
  await expect(page.locator('#object-type')).toHaveText('Cubo');
});

test('a textured GLB keeps its embedded texture under the CSP', async ({ page }) => {
  const textureErrors = [];
  page.on('console', (msg) => { if (/texture|Content Security Policy/i.test(msg.text())) textureErrors.push(msg.text()); });
  await page.goto('/');
  await page.waitForFunction(() => window.__app?._scene);
  await page.locator('#model-input').setInputFiles({
    name: 'texturizado.glb',
    mimeType: 'model/gltf-binary',
    buffer: readFileSync(new URL('./fixtures/textured-quad.glb', import.meta.url)),
  });
  await expect(page.locator('#object-type')).toHaveText('Modelo: texturizado.glb');
  const hasMap = await page.evaluate(() => {
    let found = false;
    window.__app._scene._customModel.traverse((node) => { if (node.isMesh && node.material?.map?.image) found = true; });
    return found;
  });
  expect(textureErrors).toEqual([]);
  expect(hasMap).toBe(true);
});
