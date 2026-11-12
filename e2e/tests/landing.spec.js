// @ts-check
const { test, expect, loginAs } = require('../fixtures');

// The welcome page at "/": what a first-time visitor sees and can try before creating an account.

test('la página de inicio presenta MediTrack y lleva a registrarse o iniciar sesión', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nunca más olvides');
  await expect(page.getByRole('link', { name: 'Crear mi cuenta' }).first()).toHaveAttribute('href', '/register');
  await expect(page.getByRole('link', { name: 'Iniciar sesión' }).first()).toHaveAttribute('href', '/login');
  // The legal links are there before anyone signs up.
  await expect(page.getByRole('link', { name: 'Política de privacidad' }).first()).toHaveAttribute('href', '/privacy-policy');
});

test('la demostración del hero responde: registrar una toma mueve la adherencia', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('33%')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar' }).first().click();
  await expect(page.getByText('67%')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar' }).first().click();
  await expect(page.getByText('¡Día completo!')).toBeVisible();

  await page.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page.getByText('33%')).toBeVisible();
});

test('las pestañas de funciones se pueden recorrer con el teclado', async ({ page }) => {
  await page.goto('/');
  const first = page.getByRole('tab', { name: 'Escanear fórmula' });
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute('aria-selected', 'true');

  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Recordatorios' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('Un aviso justo cuando toca');

  await page.getByRole('tab', { name: 'Cuidadores' }).click();
  const permission = page.getByRole('switch', { name: /Permiso de monitoreo/ });
  await expect(permission).toHaveAttribute('aria-checked', 'true');
  await permission.click();
  await expect(permission).toHaveAttribute('aria-checked', 'false');
});

test('las preguntas frecuentes se abren y se cierran', async ({ page }) => {
  await page.goto('/');
  const question = page.getByRole('button', { name: '¿MediTrack reemplaza a mi médico?' });
  await question.scrollIntoViewIfNeeded();

  await expect(question).toHaveAttribute('aria-expanded', 'false');
  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Las indicaciones, dosis y cambios de tratamiento')).toBeVisible();
  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'false');
});

test('quien ya inició sesión va directo a su dashboard', async ({ page, accounts }) => {
  await loginAs(page, await accounts.create());

  await page.goto('/');

  await page.waitForURL(/\/dashboard/);
});

test('en un celular no hay desplazamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
