// @ts-check
const { test, expect, loginAs } = require('../fixtures');

test('inicia sesión y muestra el dashboard', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);
  await expect(page.getByRole('button', { name: 'Agregar medicamento' }).first()).toBeVisible();
});

// Used to be a 401, which the web read as "session expired" and logged the user out over a
// mistyped password; now it's a 400 with a Spanish form error.
test('contraseña actual incorrecta: error en el formulario y la sesión sigue abierta', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);

  await page.getByRole('button', { name: `Hola, ${me.name}` }).click();
  await page.fill('input[placeholder="Contraseña actual"]', 'no-es-esta-123');
  await page.fill('input[placeholder="Contraseña nueva"]', 'NuevaClave456!');
  await page.fill('input[placeholder="Confirmar contraseña nueva"]', 'NuevaClave456!');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).last().click();

  await expect(page.getByRole('alert').filter({ hasText: 'La contraseña actual no es correcta.' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
});

// "Salir" used to only forget the session in the browser, leaving its refresh token valid on
// the server for weeks.
test('salir revoca la sesión también en el servidor', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);
  const { refreshToken } = await page.evaluate(() => JSON.parse(localStorage.getItem('meditrack.session')));

  await page.getByRole('button', { name: 'Salir' }).click();
  await page.waitForURL(/\/login/);

  const refresh = await accounts.api('POST', '/auth/refresh', { refreshToken });
  expect(refresh.status).toBe(401);
});

// Email and SMS reminders are configured on the web; mobile push only from the app (the web just
// shows its state).
test('preferencias de avisos: correo, SMS con teléfono, y el móvil solo informativo', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);
  await page.getByRole('button', { name: `Hola, ${me.name}` }).click();

  await expect(page.getByText('Notificaciones en el móvil:')).toBeVisible();
  await expect(page.getByLabel('Recibir también los avisos de las personas a mi cargo')).toHaveCount(0);

  await page.getByLabel('Recibir avisos por SMS').check();
  await page.getByRole('button', { name: 'Guardar avisos' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Escribe tu número de teléfono' })).toBeVisible();

  await page.getByLabel('Número de teléfono').fill('+57 300 123 4567');
  await page.getByRole('radiogroup').last().getByText('Ambos').click();
  await page.getByLabel('Recibir avisos por correo').uncheck();
  await page.getByRole('button', { name: 'Guardar avisos' }).click();
  await expect(page.getByText('Preferencias de avisos guardadas.')).toBeVisible();

  const saved = await accounts.api('GET', '/users/me/notification-preferences', null, me.token);
  expect(saved.body).toMatchObject({ emailEnabled: false, smsEnabled: true, smsTiming: 'BOTH', phoneNumber: '+57 300 123 4567' });
});
