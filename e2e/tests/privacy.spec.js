// @ts-check
const { test, expect, loginAs } = require('../fixtures');

// Prescription photos are read by an external AI provider (Anthropic) — see the backend's
// PrescriptionScanService. The policy users consent to, and every scan prompt, must say so;
// they used to promise the opposite ("never sent to third-party AI services").
const FALSE_CLAIM = /propia infraestructura|nuestro propio servidor|nunca se envía a servicios de IA|sin enviarla a servicios de IA/i;

test('la política de privacidad declara el proveedor externo del escaneo', async ({ page }) => {
  await page.goto('/privacy-policy');
  await expect(page.getByText(/Versión v1\.2/)).toBeVisible();
  await expect(page.getByText('Anthropic, PBC (Estados Unidos)')).toBeVisible();
  await expect(page.getByText('transferencia internacional')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(FALSE_CLAIM);
});

test('el escaneo avisa de que la foto sale a un servicio externo', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);
  await expect(page.locator('body')).not.toContainText(FALSE_CLAIM);

  await page.getByRole('button', { name: /Escanear nueva receta/ }).click();
  await expect(page.getByText(/se envía a un servicio externo de inteligencia artificial/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(FALSE_CLAIM);
});
