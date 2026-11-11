# Pruebas end-to-end de la web

Prueban la web en un navegador real (Playwright) contra el stack completo corriendo en local:
login, dashboard, medicamentos, modo cuidador, contacto de emergencia y los errores que
devuelve el backend. **Cada prueba se ejecuta tres veces, una por zona horaria**
(`America/Bogota`, `Europe/Madrid`, `UTC`), porque la API envía las fechas con zona horaria
y la web tiene que mostrar la hora local correcta en todas (ver `ApiDateTimeConfig` en
`meditrack-backend`).

## Requisitos

1. El stack levantado desde la **raíz del repo** (así se carga también
   `docker-compose.override.yml`):

   ```bash
   docker compose up -d --build
   ```

   Reconstruir solo `web` o `app` con nginx ya corriendo funciona sin reiniciarlo: nginx
   vuelve a resolver su IP cada 10 s (`resolve` en los `nginx/upstream.conf`). Justo después
   de recrear un contenedor puede haber unos segundos de 502 mientras arranca.

2. Google Chrome instalado (se usa el del sistema). Si no lo tienes, usa el Chromium de
   Playwright:

   ```bash
   npx playwright install chromium
   E2E_BROWSER=chromium npm test
   ```

## Ejecutar

```bash
cd meditrack-web/e2e
npm install        # solo la primera vez
npm test           # todas las pruebas, en las 3 zonas horarias
npm run report     # abre el informe HTML de la última ejecución
```

Otras formas útiles:

```bash
npx playwright test tests/caregiver.spec.js          # un solo archivo
npx playwright test --project=Europe/Madrid          # una sola zona horaria
npx playwright test --headed                         # viendo el navegador
E2E_BASE_URL=http://otro-host npm test               # contra otro entorno
```

## Datos de prueba

Cada prueba crea sus propias cuentas (`e2e-web-…@example.com`) y las **desactiva al
terminar** (en el backend, eliminar una cuenta es un borrado lógico). Las pruebas son
independientes entre sí y se ejecutan en paralelo.

Los dependientes sin cuenta propia que crea una prueba se desactivan junto con la cuenta de
su cuidador (ver `AccountDeactivationService` en el backend), así que no quedan perfiles
activos sueltos.

## Qué cubre

| Archivo | Qué comprueba |
|---|---|
| `account.spec.js` | Login; contraseña actual incorrecta → error en el formulario sin cerrar la sesión |
| `treatments.spec.js` | Un medicamento "tomado hace 5 minutos" se guarda y se muestra a la hora local escrita; la siguiente dosis cae 8 h después |
| `caregiver.spec.js` | Eliminar al dependiente que se está viendo vuelve al perfil propio (sin peticiones al perfil eliminado); dependiente sin permiso → mensaje específico; código de invitación de un perfil eliminado → rechazado |
| `privacy.spec.js` | La política (v1.2) y los avisos de escaneo dicen que la foto se envía a un proveedor externo (Anthropic), y no queda ningún texto que prometa lo contrario |
| `emergency-contact.spec.js` | Agregar, validar, editar y quitar el contacto de emergencia, también para un dependiente |

Además, todas fallan si la página lanza un error de JavaScript sin capturar.
