// @ts-check
const { test, expect, loginAs, switchProfile } = require('../fixtures');

async function openContactForm(page, action) {
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByLabel('Nombre del contacto de emergencia')).toBeVisible();
}

test('agregar, editar y quitar el contacto de emergencia', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);
  await expect(page.getByText('No hay un contacto de emergencia registrado.')).toBeVisible();

  // Validation happens before anything is sent.
  await openContactForm(page, 'Agregar');
  await page.getByLabel('Nombre del contacto de emergencia').fill('María Gómez');
  await page.getByLabel('Teléfono del contacto de emergencia').fill('12ab');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ingresa un teléfono válido.' })).toBeVisible();

  await page.getByLabel('Teléfono del contacto de emergencia').fill('300 123 4567');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Contacto de emergencia · 300 123 4567')).toBeVisible();
  await expect(page.getByText('María Gómez', { exact: true })).toBeVisible();

  // The SOS card shows it too.
  await page.getByRole('button', { name: 'Ver Ficha SOS' }).click();
  await expect(page.getByText('María Gómez').last()).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).first().click();

  // Edit: the form comes prefilled.
  await openContactForm(page, 'Editar');
  await expect(page.getByLabel('Nombre del contacto de emergencia')).toHaveValue('María Gómez');
  await page.getByLabel('Nombre del contacto de emergencia').fill('María Gómez (hija)');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('María Gómez (hija)', { exact: true })).toBeVisible();

  // Remove: asks for a second click first.
  await openContactForm(page, 'Editar');
  await page.getByRole('button', { name: 'Quitar contacto' }).click();
  await page.getByRole('button', { name: 'Haz clic otra vez para quitarlo' }).click();
  await expect(page.getByText('No hay un contacto de emergencia registrado.')).toBeVisible();
});

test('el cuidador edita el contacto de emergencia de un dependiente sin tocar el suyo', async ({ page, accounts }) => {
  const me = await accounts.create();
  const rosaName = `Rosa ${accounts.unique()}`;
  const rosa = (await accounts.api('POST', '/users/dependents', { name: rosaName }, me.token)).body;
  await loginAs(page, me);
  await switchProfile(page, me.name, rosaName);

  await openContactForm(page, 'Agregar');
  await page.getByLabel('Nombre del contacto de emergencia').fill('Cuidadora');
  await page.getByLabel('Teléfono del contacto de emergencia').fill('+57 (1) 234-5678');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Contacto de emergencia · +57 (1) 234-5678')).toBeVisible();

  const rosaCard = (await accounts.api('GET', `/emergency-card?profileId=${rosa.id}`, null, me.token)).body;
  const myCard = (await accounts.api('GET', '/emergency-card', null, me.token)).body;
  expect(rosaCard.emergencyContactName).toBe('Cuidadora');
  expect(myCard.emergencyContactName).toBeNull();
});
