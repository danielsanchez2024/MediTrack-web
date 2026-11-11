// @ts-check
const base = require('@playwright/test');

const PASSWORD = 'E2eCheck123!';

// Talks to the backend directly — for setting up state a test needs but isn't about
// (a dependent to delete, an invite code, ...), which is faster and less brittle than the UI.
async function api(baseURL, method, path, body, token) {
  const response = await fetch(`${baseURL}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const test = base.test.extend({
  // Every account a test creates is deactivated afterwards (deleting an account on the
  // backend is a soft delete), so runs don't leave usable test users behind.
  accounts: async ({ baseURL }, use, testInfo) => {
    const created = [];
    const unique = () => `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 7)}`;
    const call = (method, path, body, token) => api(baseURL, method, path, body, token);
    const login = async (email) => (await call('POST', '/auth/login', { email, password: PASSWORD })).body?.token;

    await use({
      password: PASSWORD,
      unique,
      api: call,
      login,
      async create(name = 'E2E Prueba') {
        const email = `e2e-web-${unique()}@example.com`;
        const res = await call('POST', '/auth/register', {
          name, email, password: PASSWORD, confirmPassword: PASSWORD, healthDataConsentAccepted: true
        });
        if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
        created.push(email);
        return { name, email, token: await login(email) };
      },
      // For accounts created some other way (e.g. a dependent claiming theirs).
      track: (email) => created.push(email)
    });

    for (const email of created) {
      const token = await login(email).catch(() => null);
      if (token) await call('DELETE', '/auth/account', null, token);
    }
  },

  // Fails any test that throws an uncaught JavaScript error on the page.
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    base.expect(errors, 'uncaught JavaScript errors on the page').toEqual([]);
  }
});

async function loginAs(page, account) {
  await page.goto('/login');
  await page.fill('#email', account.email);
  await page.fill('input[type=password]', PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/);
  await base.expect(page.getByText(`Hola, ${account.name}`)).toBeVisible();
}

// The profile switcher only shows up once there's more than one profile.
async function switchProfile(page, from, to) {
  await page.getByText(`Viendo perfil de: ${from}`).click();
  await page.getByRole('button', { name: to }).click();
  await base.expect(page.getByText(`Viendo perfil de: ${to}`)).toBeVisible();
}

module.exports = { test, expect: base.expect, loginAs, switchProfile };
