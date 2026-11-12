// @ts-check
const { test, expect, loginAs } = require('../fixtures');

// What the user is told, and what actually leaves the browser, when scanning a prescription.
// The /prescriptions/* calls are intercepted: these tests never reach an AI provider.

async function openScanModal(page) {
  await page.getByRole('button', { name: /Escanear nueva receta/ }).click();
  await expect(page.getByRole('heading', { name: 'Escanear fórmula médica' })).toBeVisible();
}

// An 800x600 image with a gradient, built in the page (no fixture file to keep around).
async function pickImage(page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#888888');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('#prescriptionImage', {
    name: 'receta.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64')
  });
}

// Width/height of the first JPEG found in a multipart body (reads the SOF marker).
function jpegSize(body) {
  const start = body.indexOf(Buffer.from([0xff, 0xd8]));
  expect(start, 'the upload should contain a JPEG').toBeGreaterThanOrEqual(0);
  for (let i = start + 2; i < body.length - 9; i++) {
    if (body[i] === 0xff && (body[i + 1] === 0xc0 || body[i + 1] === 0xc2)) {
      return { height: body.readUInt16BE(i + 5), width: body.readUInt16BE(i + 7) };
    }
  }
  throw new Error('no SOF marker found');
}

function stubProvider(page, info) {
  return page.route('**/api/v1/prescriptions/provider', (route) => route.fulfill({ json: info }));
}

function captureScan(page) {
  /** @type {{ body: Buffer | null }} */
  const captured = { body: null };
  page.route('**/api/v1/prescriptions/scan', (route) => {
    captured.body = route.request().postDataBuffer();
    return route.fulfill({ json: { medications: [] } });
  });
  return captured;
}

test('con un proveedor sin verificar el aviso es visible y no se puede leer sin aceptar', async ({ page, accounts }) => {
  await stubProvider(page, { provider: 'openai-compatible', dataPolicy: 'unverified', consentRequired: true });
  const captured = captureScan(page);
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  await expect(page.getByText('no están verificadas')).toBeVisible();
  const read = page.getByRole('button', { name: 'Leer fórmula' });
  await expect(read).toBeDisabled();

  await page.getByLabel(/Entiendo y acepto/).check();
  await expect(read).toBeEnabled();
  await read.click();

  await expect(page.getByText(/Detectamos 1 medicamento/)).toBeVisible();
  const body = captured.body?.toString('latin1') ?? '';
  expect(body).toContain('name="dataSharingConsent"');
  expect(body).toMatch(/name="dataSharingConsent"\r\n\r\ntrue/);
});

test('con un proveedor verificado no pide consentimiento y lo dice', async ({ page, accounts }) => {
  await stubProvider(page, { provider: 'anthropic', dataPolicy: 'verified', consentRequired: false });
  captureScan(page);
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  await expect(page.getByText(/solo para leerla/)).toBeVisible();
  await expect(page.getByLabel(/Entiendo y acepto/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Leer fórmula' })).toBeEnabled();
});

test('si no se puede consultar el proveedor se aplica la opción más estricta', async ({ page, accounts }) => {
  await page.route('**/api/v1/prescriptions/provider', (route) => route.abort());
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  await expect(page.getByLabel(/Entiendo y acepto/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leer fórmula' })).toBeDisabled();
});

test('lo recortado es lo único que sale del navegador, re-codificado como JPEG', async ({ page, accounts }) => {
  await stubProvider(page, { provider: 'anthropic', dataPolicy: 'verified', consentRequired: false });
  const captured = captureScan(page);
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  const preview = page.getByAltText('Foto de la fórmula');
  await expect(preview).toBeVisible();
  const box = await preview.boundingBox();
  if (!box) throw new Error('preview has no box');

  // Frame the region from (10%,10%) to (60%,40%) of the photo.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel('Zona seleccionada')).toBeVisible();

  await page.getByRole('button', { name: 'Leer fórmula' }).click();
  await expect(page.getByText(/Detectamos 1 medicamento/)).toBeVisible();

  const body = captured.body;
  if (!body) throw new Error('the scan request was not captured');
  const { width, height } = jpegSize(body);
  // 800x600 photo, 50% x 30% crop => 400x180 (tolerance for rounding of the drag position).
  expect(Math.abs(width - 400)).toBeLessThanOrEqual(8);
  expect(Math.abs(height - 180)).toBeLessThanOrEqual(8);
  expect(body.toString('latin1')).toContain('image/jpeg');
});

test('sin recortar sube la foto entera, también re-codificada', async ({ page, accounts }) => {
  await stubProvider(page, { provider: 'anthropic', dataPolicy: 'verified', consentRequired: false });
  const captured = captureScan(page);
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  await page.getByRole('button', { name: 'Leer fórmula' }).click();
  await expect(page.getByText(/Detectamos 1 medicamento/)).toBeVisible();

  const body = captured.body;
  if (!body) throw new Error('the scan request was not captured');
  expect(jpegSize(body)).toEqual({ width: 800, height: 600 });
});

test('si un administrador pausó la lectura, el escaneo lo avisa y no deja continuar', async ({ page, accounts }) => {
  await stubProvider(page, { provider: 'anthropic', dataPolicy: 'verified', consentRequired: false, available: false });
  await loginAs(page, await accounts.create());
  await openScanModal(page);
  await pickImage(page);

  await expect(page.getByText('La lectura de fórmulas está en pausa por ahora')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leer fórmula' })).toBeDisabled();
});
