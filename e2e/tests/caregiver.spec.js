// @ts-check
const { test, expect, loginAs, switchProfile } = require('../fixtures');

// Deleting a dependent only deactivates it; the list used to keep it, then (once the backend
// filtered it out) the dashboard kept pointing at it and 404'd on its next refresh.
test('eliminar al dependiente que se está viendo vuelve al perfil propio', async ({ page, accounts }) => {
  const me = await accounts.create();
  const rosaName = `Rosa ${accounts.unique()}`;
  const rosa = (await accounts.api('POST', '/users/dependents', { name: rosaName }, me.token)).body;
  await loginAs(page, me);
  await switchProfile(page, me.name, rosaName);

  await page.getByText('Gestionar').first().click();
  await page.getByRole('button', { name: `Eliminar perfil de ${rosaName}` }).click();
  const staleRequests = [];
  page.on('request', (request) => {
    if (request.url().includes(rosa.id) && request.method() !== 'DELETE') staleRequests.push(request.url());
  });
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByRole('button', { name: `Eliminar perfil de ${rosaName}` })).toBeHidden();
  await page.getByRole('button', { name: 'Cerrar' }).first().click();

  // Back on the user's own profile, with no trace of the deleted one anywhere on the page.
  await expect(page.getByRole('heading', { name: me.name })).toBeVisible();
  await expect(page.getByText(rosaName)).toHaveCount(0);
  // What the 60 s refresh or any other button does next must not target the deleted profile.
  await page.getByRole('button', { name: 'Mis tratamientos' }).click();
  await expect(page.getByText('No pudimos cargar los tratamientos.')).toBeHidden();
  expect(staleRequests).toEqual([]);
  await expect(page.getByText('No pudimos cargar la información de este perfil.')).toBeHidden();
});

test('un dependiente con cuenta propia que no dio acceso muestra el motivo', async ({ page, accounts }) => {
  const me = await accounts.create();
  const luisName = `Luis ${accounts.unique()}`;
  const luis = (await accounts.api('POST', '/users/dependents', { name: luisName }, me.token)).body;
  const code = (await accounts.api('POST', `/users/dependents/${luis.id}/invite`, null, me.token)).body.claimToken;
  const luisEmail = `e2e-web-dep-${accounts.unique()}@example.com`;
  await accounts.api('POST', '/auth/claim-account', {
    claimToken: code, email: luisEmail, password: accounts.password, confirmPassword: accounts.password
  });
  accounts.track(luisEmail);

  await loginAs(page, me);
  await switchProfile(page, me.name, luisName);
  await expect(page.getByText('Esta persona ya tiene su propia cuenta y no te ha dado acceso a sus datos.')).toBeVisible();
});

test('un código de invitación de un perfil ya eliminado se rechaza', async ({ page, accounts }) => {
  const me = await accounts.create();
  const ana = (await accounts.api('POST', '/users/dependents', { name: `Ana ${accounts.unique()}` }, me.token)).body;
  const code = (await accounts.api('POST', `/users/dependents/${ana.id}/invite`, null, me.token)).body.claimToken;
  await accounts.api('DELETE', `/users/dependents/${ana.id}`, null, me.token);

  await page.goto(`/claim-account?token=${code}`);
  await page.locator('input[type=email]').fill(`e2e-web-ana-${accounts.unique()}@example.com`);
  await page.getByRole('button', { name: /Continuar|Siguiente/ }).click();
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill(accounts.password);
  await passwords.nth(1).fill(accounts.password);
  await page.locator('form button[type=submit]').last().click();

  await expect(page.getByRole('alert')).toContainText('Este código de invitación no es válido o expiró.');
  await expect(page).not.toHaveURL(/\/dashboard/);
});
