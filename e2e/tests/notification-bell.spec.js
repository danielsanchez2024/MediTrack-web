// @ts-check
const { test, expect, loginAs, switchProfile } = require('../fixtures');

// The notification bell: one switch for the account's "notificaciones en el móvil" preference, this
// browser's permission, and an inbox of recent reminders.

// Replaces the browser's Notification with a recorder, so the tests can see what would be shown.
async function fakeNotifications(page, permission = 'granted') {
  await page.addInitScript((initial) => {
    // @ts-ignore
    window.__shown = [];
    class FakeNotification {
      static permission = initial;
      static requestPermission() {
        FakeNotification.permission = 'granted';
        return Promise.resolve('granted');
      }
      constructor(title, options) {
        // @ts-ignore
        window.__shown.push({ title, body: options && options.body });
      }
    }
    // @ts-ignore
    window.Notification = FakeNotification;
  }, permission);
}

const shown = (page) => page.evaluate(() => /** @type {any} */ (window).__shown);
const inMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

async function setPreferences(accounts, token, changes) {
  const current = (await accounts.api('GET', '/users/me/notification-preferences', null, token)).body;
  const saved = await accounts.api('PUT', '/users/me/notification-preferences', { ...current, ...changes }, token);
  expect(saved.status).toBe(200);
}

async function createUpcomingTreatment(accounts, token, name = 'Metformina', query = '') {
  const created = await accounts.api('POST', `/treatments${query}`, {
    medicationName: name, dosage: '1 tableta', frequencyValue: 8, frequencyUnit: 'HOURS',
    startDate: inMinutes(5), firstDoseAlreadyTaken: false
  }, token);
  expect(created.status).toBe(201);
}

test('se acerca una dosis: llega a la campanita y al navegador, una sola vez', async ({ page, accounts }) => {
  await fakeNotifications(page);
  const me = await accounts.create();
  await createUpcomingTreatment(accounts, me.token);
  await loginAs(page, me);

  await expect(page.getByTestId('bell-unread')).toHaveText('1');
  const first = await shown(page);
  expect(first).toHaveLength(1);
  expect(first[0].title).toBe('Se acerca una dosis');
  expect(first[0].body).toContain('Metformina');

  await page.getByRole('button', { name: /Notificaciones, 1 sin leer/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notificaciones' });
  await expect(panel.getByText('Se acerca una dosis')).toBeVisible();
  await expect(panel.getByText(/Metformina/)).toBeVisible();
  await expect(page.getByTestId('bell-unread')).toHaveCount(0); // opening marks them as read

  // After a reload the same reminder is neither announced again nor lost from the inbox.
  await page.reload();
  await expect(page.getByText(`Hola, ${me.name}`)).toBeVisible();
  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByRole('dialog', { name: 'Notificaciones' }).getByText('Se acerca una dosis')).toBeVisible();
  expect(await shown(page)).toHaveLength(0);
  await expect(page.getByTestId('bell-unread')).toHaveCount(0);
});

test('con la campanita apagada no hay avisos; encenderla guarda la preferencia y avisa', async ({ page, accounts }) => {
  await fakeNotifications(page);
  const me = await accounts.create();
  await setPreferences(accounts, me.token, { pushEnabled: false });
  await createUpcomingTreatment(accounts, me.token);
  await loginAs(page, me);

  await expect(page.getByTestId('bell-unread')).toHaveCount(0);
  expect(await shown(page)).toHaveLength(0);

  await page.getByRole('button', { name: 'Notificaciones' }).click();
  const panel = page.getByRole('dialog', { name: 'Notificaciones' });
  const toggle = panel.getByRole('switch', { name: 'Avisos de tomas' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(panel.getByText(/Celular:\s*desactivado/)).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText(/Celular:\s*activado/)).toBeVisible();
  const saved = await accounts.api('GET', '/users/me/notification-preferences', null, me.token);
  expect(saved.body.pushEnabled).toBe(true);
  // The account's other channels are left alone.
  expect(saved.body.emailEnabled).toBe(true);

  await expect.poll(async () => (await shown(page)).length).toBe(1);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect((await accounts.api('GET', '/users/me/notification-preferences', null, me.token)).body.pushEnabled).toBe(false);
});

test('respeta el momento elegido: "a la hora" no avisa antes de la toma', async ({ page, accounts }) => {
  await fakeNotifications(page);
  const me = await accounts.create();
  await setPreferences(accounts, me.token, { pushTiming: 'AT_TIME' });
  await createUpcomingTreatment(accounts, me.token);
  await loginAs(page, me);

  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByRole('dialog', { name: 'Notificaciones' }).getByText(/a la hora de la toma/).first()).toBeVisible();
  await expect(page.getByTestId('bell-unread')).toHaveCount(0);
  expect(await shown(page)).toHaveLength(0);
});

test('si falta el permiso del navegador, la campanita lo pide', async ({ page, accounts }) => {
  await fakeNotifications(page, 'default');
  await loginAs(page, await accounts.create());

  await page.getByRole('button', { name: 'Notificaciones' }).click();
  const panel = page.getByRole('dialog', { name: 'Notificaciones' });
  await expect(panel.getByText('falta tu permiso para mostrarlas')).toBeVisible();

  await panel.getByRole('button', { name: 'Permitir en este navegador' }).click();
  await expect(panel.getByText(/activadas antes y a la hora de la toma/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Permitir en este navegador' })).toHaveCount(0);
});

test('un navegador que bloqueó los avisos lo explica sin romper nada', async ({ page, accounts }) => {
  await fakeNotifications(page, 'denied');
  await loginAs(page, await accounts.create());

  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByRole('dialog', { name: 'Notificaciones' }).getByText(/bloqueadas/)).toBeVisible();
});

test('el aviso de la dosis de un dependiente dice de quién es', async ({ page, accounts }) => {
  await fakeNotifications(page);
  const me = await accounts.create();
  const luis = (await accounts.api('POST', '/users/dependents', { name: 'Luis Prueba' }, me.token)).body;
  await createUpcomingTreatment(accounts, me.token, 'Atorvastatina', `?profileId=${luis.id}`);
  await loginAs(page, me);
  await switchProfile(page, me.name, 'Luis Prueba');

  await expect(page.getByTestId('bell-unread')).toHaveText('1');
  const [item] = await shown(page);
  expect(item.body).toContain('Luis Prueba: Atorvastatina');
});

test('en un celular el panel de la campanita cabe en la pantalla', async ({ page, accounts }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeNotifications(page);
  const me = await accounts.create();
  await createUpcomingTreatment(accounts, me.token);
  await loginAs(page, me);

  await page.getByRole('button', { name: /Notificaciones/ }).click();
  const box = await page.getByRole('dialog', { name: 'Notificaciones' }).boundingBox();
  if (!box) throw new Error('the panel is not visible');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Escape cierra la campanita y devuelve el foco al botón', async ({ page, accounts }) => {
  await fakeNotifications(page);
  await loginAs(page, await accounts.create());

  const bell = page.getByRole('button', { name: 'Notificaciones' });
  await bell.click();
  await expect(page.getByRole('dialog', { name: 'Notificaciones' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notificaciones' })).toBeHidden();
  await expect(bell).toBeFocused();
});
