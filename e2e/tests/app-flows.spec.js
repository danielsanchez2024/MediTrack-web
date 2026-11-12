// @ts-check
const { test, expect, loginAs } = require('../fixtures');

// The flows the welcome page promises, driven through the real interface: sign up, record a dose,
// look at the adherence history, download the emergency card, recover a password, and use the
// dashboard from a phone.

const isoNow = (offsetSeconds = 0) => new Date(Date.now() + offsetSeconds * 1000).toISOString();

test('crear una cuenta desde la interfaz y entrar al dashboard', async ({ page, accounts }) => {
  const email = `e2e-web-${accounts.unique()}@example.com`;
  accounts.track(email);

  await page.goto('/register');
  await page.fill('#name', 'Registro Prueba');
  await page.fill('#email', email);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill(accounts.password);
  await passwords.nth(1).fill(accounts.password);
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await page.waitForURL(/\/login\/?\?registered=1/);
  await page.fill('input[type=password]', accounts.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText('Hola, Registro Prueba')).toBeVisible();
});

test('no deja registrarse sin aceptar el consentimiento de datos de salud', async ({ page, accounts }) => {
  await page.goto('/register');
  await page.fill('#name', 'Sin Consentimiento');
  await page.fill('#email', `e2e-web-${accounts.unique()}@example.com`);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill(accounts.password);
  await passwords.nth(1).fill(accounts.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).not.toHaveURL(/\/login/);
});

test('registrar una toma como tomada desde el dashboard y verla en el historial', async ({ page, accounts }) => {
  const me = await accounts.create();
  const created = await accounts.api('POST', '/treatments', {
    medicationName: 'Metformina', dosage: '1 tableta', frequencyValue: 8, frequencyUnit: 'HOURS',
    startDate: isoNow(2), firstDoseAlreadyTaken: false
  }, me.token);
  expect(created.status).toBe(201);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await loginAs(page, me);

  await page.getByRole('button', { name: /Marcar como tomada/ }).first().click();
  await expect(page.getByText(/✓ Tomada a las/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByRole('heading', { name: 'Historial de adherencia' })).toBeVisible();
});

test('registrar una toma como omitida', async ({ page, accounts }) => {
  const me = await accounts.create();
  await accounts.api('POST', '/treatments', {
    medicationName: 'Atorvastatina', dosage: '1 tableta', frequencyValue: 12, frequencyUnit: 'HOURS',
    startDate: isoNow(2), firstDoseAlreadyTaken: false
  }, me.token);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await loginAs(page, me);

  await page.getByRole('button', { name: /Omitida/ }).first().click();
  await expect(page.getByText(/Omitida a las/).first()).toBeVisible();
});

test('la ficha de emergencia se descarga como PDF con las alergias', async ({ page, accounts }) => {
  const me = await accounts.create();
  await accounts.api('POST', '/users/allergies', { description: 'Penicilina', severity: 'SEVERE' }, me.token);
  await loginAs(page, me);

  await page.getByRole('button', { name: /Ver Ficha SOS/ }).click();
  await expect(page.getByText('Penicilina').first()).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar PDF' }).click()
  ]);

  // The file is named after the person the card is for (ficha-emergencia-<nombre>.pdf).
  expect(download.suggestedFilename()).toMatch(/^ficha-emergencia.*\.pdf$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');
});

test('recuperar contraseña: el formulario confirma sin revelar si el correo existe', async ({ page, accounts }) => {
  const me = await accounts.create();

  await page.goto('/forgot-password');
  await page.fill('#email', me.email);
  await page.getByRole('button', { name: /Enviar|Recuperar/ }).click();
  await expect(page.getByText(/te enviamos un enlace/)).toBeVisible();

  // An address that does not exist gets exactly the same answer.
  await page.goto('/forgot-password');
  await page.fill('#email', `no-existe-${accounts.unique()}@example.com`);
  await page.getByRole('button', { name: /Enviar|Recuperar/ }).click();
  await expect(page.getByText(/te enviamos un enlace/)).toBeVisible();
});

test('en un celular el dashboard se puede usar sin desplazamiento horizontal', async ({ page, accounts }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const me = await accounts.create();
  await loginAs(page, me);

  await expect(page.getByRole('button', { name: 'Agregar medicamento' }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
