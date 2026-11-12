// @ts-check
const { test, expect } = require('../fixtures');

// The administration panel: live traffic, business flows, AI usage, system health, the emergency
// switches and the audit trail. It only ever shows aggregates.

// The user id is the token's subject: the panel checks the role with it, so it must be real.
const userIdOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;

async function openPanelAs(page, me) {
  await page.goto('/login');
  await page.evaluate((session) => localStorage.setItem('meditrack.session', JSON.stringify(session)), {
    token: me.token, refreshToken: '', userId: userIdOf(me.token), name: me.name
  });
  await page.goto('/admin');
}

async function adminPage(page, accounts) {
  const me = await accounts.create('Admin Prueba');
  if (!accounts.promoteToAdmin(me.email)) test.skip(true, 'cannot promote an admin: is the local database container running?');
  // Some traffic for the panel to show: successful calls, a wrong login and an unauthenticated call.
  for (let i = 0; i < 6; i++) await accounts.api('GET', '/users/dependents', null, me.token);
  await accounts.api('POST', '/auth/login', { email: `nadie-${accounts.unique()}@example.com`, password: 'incorrecta1' });
  await accounts.api('GET', '/users/dependents');
  await openPanelAs(page, me);
  await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
  return me;
}

test('quien no es administrador no ve el panel', async ({ page, accounts }) => {
  await openPanelAs(page, await accounts.create());

  await expect(page.getByText('No tienes acceso a esta sección')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tráfico' })).toHaveCount(0);
});

test('el resumen muestra indicadores, gráficas e interruptores', async ({ page, accounts }) => {
  await adminPage(page, accounts);

  for (const label of ['Peticiones por minuto', 'Errores del servidor (5xx)', 'Latencia p95', 'Base de datos', 'Memoria del servidor', 'Lecturas con IA hoy']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Peticiones', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interruptores de emergencia' })).toBeVisible();
  await expect(page.getByText('Responde')).toBeVisible();
});

test('tráfico: cifras, endpoints y lectura de la gráfica con el teclado', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Tráfico' }).click();

  await expect(page.getByText('Peticiones', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Endpoints más usados' })).toBeVisible();
  // a cell's accessible name is "<METHOD><path>"
  await expect(page.getByRole('cell', { name: 'GET/api/v1/users/dependents', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'POST/api/v1/auth/login', exact: true })).toBeVisible();

  const chart = page.getByLabel(/^Peticiones\. /);
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(chart.getByText('Peticiones', { exact: true })).toBeVisible(); // the tooltip row
});

test('cambiar el periodo vuelve a pedir los datos', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Tráfico' }).click();

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/admin/ops/traffic?range=24h') && r.ok()),
    page.getByRole('radio', { name: '24 horas' }).click()
  ]);
  expect((await response.json()).range).toBe('24h');
  await expect(page.getByRole('radio', { name: '24 horas' })).toHaveAttribute('aria-checked', 'true');
});

test('cada gráfica tiene su vista de tabla', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Tráfico' }).click();

  await page.getByRole('button', { name: 'Ver como tabla' }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Hora' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver gráfica' }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Hora' })).toHaveCount(0);
});

test('flujos: inicios de sesión y demás resultados de negocio', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Flujos' }).click();

  const login = page.getByRole('article', { name: 'Inicios de sesión' });
  await expect(login.getByText('Correctos')).toBeVisible();
  await expect(login.getByText('Fallidos (credenciales incorrectas)')).toBeVisible();
  for (const title of ['Registro de cuentas', 'Lectura de fórmulas con IA', 'Tratamientos', 'Tomas', 'Correos', 'Recordatorios de dosis']) {
    await expect(page.getByRole('article', { name: title })).toBeVisible();
  }
});

test('IA y límites: proveedor, política de datos y contadores', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'IA y límites' }).click();

  await expect(page.getByText('Quién lee las fórmulas')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Lecturas hoy (todos los usuarios)' })).toBeVisible();
  await expect(page.getByText(/Condiciones de datos (verificadas|sin verificar)/)).toBeVisible();
});

test('sistema: servidor, recursos y gráficas de memoria y CPU', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Sistema' }).click();

  await expect(page.getByText('Tiempo encendido')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Memoria del servidor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Memoria usada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CPU del proceso' })).toBeVisible();
});

test('pausar y reactivar un interruptor: pide motivo, queda auditado y cambia el estado', async ({ page, accounts }, testInfo) => {
  // A switch is global state: only one project may flip it at a time.
  test.skip(testInfo.project.name !== 'America/Bogota', 'global switch, run once');
  const me = await adminPage(page, accounts);
  await page.getByRole('tab', { name: 'Control y auditoría' }).click();

  const card = page.getByRole('article', { name: 'Recordatorios por SMS' });
  try {
    await expect(card.getByText('Activo', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Pausar' }).click();
    const confirm = card.getByRole('button', { name: 'Confirmar pausa' });
    await expect(confirm).toBeDisabled(); // a reason is required
    await card.getByLabel(/Motivo/).fill('prueba automática del panel');
    await confirm.click();

    await expect(card.getByText('Pausado', { exact: true })).toBeVisible();
    await expect(card.getByText('prueba automática del panel')).toBeVisible();
    const states = await accounts.api('GET', '/admin/ops/switches', null, me.token);
    expect(states.body.find((s) => s.key === 'SMS_REMINDERS').enabled).toBe(false);

    // Earlier runs leave their own entries, so look at the rows with THIS admin's email.
    const audit = page.getByRole('table', { name: 'Registro de auditoría' });
    const mine = audit.getByRole('row').filter({ hasText: me.email });
    await expect(mine.filter({ hasText: 'Pausó' })).toHaveCount(1);
    await expect(mine.filter({ hasText: 'prueba automática del panel' })).toHaveCount(1);

    await card.getByRole('button', { name: 'Reactivar' }).click();
    await card.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(card.getByText('Activo', { exact: true })).toBeVisible();
    await expect(mine.filter({ hasText: 'Reactivó' })).toHaveCount(1);
  } finally {
    // Never leave the shared stack with a channel switched off.
    await accounts.api('PUT', '/admin/ops/switches/SMS_REMINDERS', { enabled: true, reason: null }, me.token);
  }
});

test('el modo en vivo se puede pausar', async ({ page, accounts }) => {
  await adminPage(page, accounts);

  const live = page.getByRole('button', { name: 'En vivo' });
  await expect(live).toHaveAttribute('aria-pressed', 'true');
  await live.click();
  await expect(page.getByRole('button', { name: 'En pausa' })).toHaveAttribute('aria-pressed', 'false');
});

test('en un celular las pestañas se desplazan y la página no se desborda', async ({ page, accounts }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await adminPage(page, accounts);

  await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
  await page.getByRole('tab', { name: 'Políticas' }).scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('lo que devuelve el panel de operaciones no contiene correos ni direcciones IP', async ({ accounts }) => {
  const me = await accounts.create('Admin Prueba');
  if (!accounts.promoteToAdmin(me.email)) test.skip(true, 'cannot promote an admin');
  await accounts.api('POST', '/auth/login', { email: `secreto-${accounts.unique()}@example.com`, password: 'incorrecta1' });
  await accounts.api('GET', `/users/${'3f2a9c1e-1b2d-4c3e-8f4a-5b6c7d8e9f01'}/allergies`, null, me.token);

  for (const path of ['/overview', '/traffic?range=24h', '/endpoints?range=24h', '/flows?range=24h']) {
    const res = await accounts.api('GET', `/admin/ops${path}`, null, me.token);
    expect(res.status).toBe(200);
    // Admin staff appear by design in "who changed this switch"; nobody else may appear anywhere.
    const body = path === '/overview'
      ? { ...res.body, switches: res.body.switches.map((s) => ({ ...s, updatedBy: null })) }
      : res.body;
    const text = JSON.stringify(body);
    expect(text, path).not.toMatch(/@/);
    expect(text, path).not.toContain('secreto-'); // the wrong-login address used above
    expect(text, path).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    expect(text, path).not.toContain('3f2a9c1e-1b2d'); // ids are grouped as {id}
  }
});

test('un usuario normal recibe 403 en todos los endpoints de operaciones', async ({ accounts }) => {
  const me = await accounts.create();
  for (const path of ['/overview', '/traffic', '/endpoints', '/flows', '/switches', '/audit']) {
    expect((await accounts.api('GET', `/admin/ops${path}`, null, me.token)).status, path).toBe(403);
  }
  const put = await accounts.api('PUT', '/admin/ops/switches/SMS_REMINDERS', { enabled: false, reason: 'x' }, me.token);
  expect(put.status).toBe(403);
});

test('usuarios: la lista se pagina y se busca en el servidor', async ({ page, accounts }) => {
  await adminPage(page, accounts);
  const target = await accounts.create('Zelda Buscable');
  await page.getByRole('tab', { name: 'Usuarios' }).click();

  await expect(page.getByText(/Mostrando \d+ de \d+/)).toBeVisible();
  // Never more than one page at a time, however many accounts exist.
  expect(await page.getByRole('button', { name: /Desactivar|Reactivar/ }).count()).toBeLessThanOrEqual(50);

  await page.getByRole('searchbox', { name: 'Buscar usuarios por nombre o correo' }).fill(target.email);
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(page.getByText('Mostrando 1 de 1')).toBeVisible();
  await expect(page.getByText(target.email)).toBeVisible();

  await page.getByRole('searchbox').fill('no-existe-' + accounts.unique());
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText(/Ningún usuario coincide/)).toBeVisible();
});
