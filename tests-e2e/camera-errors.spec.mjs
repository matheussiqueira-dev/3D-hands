import { test, expect } from '@playwright/test';

/** Makes getUserMedia reject with the given DOMException name. */
async function failCameraWith(page, name) {
  await page.addInitScript((errorName) => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('blocked', errorName));
  }, name);
}

test('a denied camera shows a PT-BR message with a retry button', async ({ page }) => {
  await failCameraWith(page, 'NotAllowedError');
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('A câmera foi bloqueada');
  const retry = alert.getByRole('button', { name: 'Tentar novamente' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(alert).toContainText('A câmera foi bloqueada');
});

test('a missing camera points to the keyboard controls', async ({ page }) => {
  await failCameraWith(page, 'NotFoundError');
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Nenhuma câmera encontrada');
  await expect(alert).toContainText('setas, N, C, R');
  await expect(alert.getByRole('button', { name: 'Tentar novamente' })).toBeHidden();
});

test('a tampered model script is blocked by SRI and reported as a model error', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 48 });
      canvas.getContext('2d').fillRect(0, 0, 64, 48);
      return canvas.captureStream(15);
    };
  });
  await page.route('**/@mediapipe/hands@*/hands.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.tampered = true;' }));
  await page.goto('/');
  await page.waitForFunction(() => window.__app);
  await page.locator('#start-btn').click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Não foi possível carregar o modelo de mãos');
  await expect(alert.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  expect(await page.evaluate(() => window.tampered)).toBeUndefined();
});
