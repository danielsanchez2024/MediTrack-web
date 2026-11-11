// @ts-check
const { test, expect, loginAs } = require('../fixtures');

// The time-zone contract end to end: the first dose is typed in the browser's local time,
// sent with its offset, and must come back displayed as that same local time — in every
// project's zone. Before the contract a browser in Madrid had "5 minutes ago" rejected as a
// future dose (the server read it as Bogotá time, 7 hours later).
test('un medicamento "tomado hace 5 minutos" se guarda y se muestra a la hora local', async ({ page, accounts }) => {
  const me = await accounts.create();
  await loginAs(page, me);

  const times = await page.evaluate(() => {
    const taken = new Date(Date.now() - 5 * 60_000);
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      input: `${taken.getFullYear()}-${pad(taken.getMonth() + 1)}-${pad(taken.getDate())}T${pad(taken.getHours())}:${pad(taken.getMinutes())}`,
      taken: fmt(taken),
      next: fmt(new Date(taken.getTime() + 8 * 3_600_000)),
      nextIsTomorrow: new Date(taken.getTime() + 8 * 3_600_000).getDate() !== taken.getDate()
    };
  });

  await page.getByRole('button', { name: 'Agregar medicamento' }).first().click();
  await page.fill('#medicationName', `Losartán ${accounts.unique()}`);
  await page.fill('#dosageAmount', '1 tableta');
  await page.fill('#frequencyValue', '8');
  await page.selectOption('#frequencyUnit', 'HOURS');
  await page.locator('input[type=checkbox]').first().check();
  await page.fill('#firstDoseAt', times.input);
  await page.getByText('Continuo / crónico').click();
  await page.locator('form button[type=submit]').last().click();

  await expect(page.getByRole('heading', { name: 'Agregar medicamento' })).toBeHidden();
  await expect(page.getByText(`Tomada a las ${times.taken}`).first()).toBeVisible();

  if (times.nextIsTomorrow) await page.getByRole('button', { name: 'Mañana' }).click();
  await expect(page.getByText(times.next).first()).toBeVisible();
});

// Editing only the instructions used to wipe and regenerate every pending dose (the web always
// resends the end date), and emptying the field did nothing at all.
test('borrar las instrucciones de un tratamiento no regenera sus tomas', async ({ page, accounts }) => {
  const me = await accounts.create();
  const name = `Amoxicilina ${accounts.unique()}`;
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(start.getTime() + 10 * 86_400_000);
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const created = await accounts.api('POST', '/treatments', {
    medicationName: name, dosage: '1 cápsula', frequencyValue: 8, frequencyUnit: 'HOURS',
    startDate: start.toISOString(), firstDoseAlreadyTaken: false, endDate: isoDate(end),
    instructions: 'Con comida'
  }, me.token);
  expect(created.status).toBe(201);
  const pendingIds = async () => {
    const res = await accounts.api('GET', `/scheduled-doses?startDate=${isoDate(new Date())}&endDate=${isoDate(end)}`, null, me.token);
    return res.body.filter((d) => d.status === 'PENDING').map((d) => d.id).sort();
  };
  const before = await pendingIds();
  expect(before.length).toBeGreaterThan(0);

  await loginAs(page, me);
  await page.getByRole('button', { name: 'Mis tratamientos' }).click();
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.locator('textarea').fill('');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
  await expect(page.getByText('Con comida')).toHaveCount(0);

  const treatments = await accounts.api('GET', '/treatments', null, me.token);
  expect(treatments.body.find((t) => t.medicationName === name).instructions).toBeNull();
  expect(await pendingIds()).toEqual(before);
});
