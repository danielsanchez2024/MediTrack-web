# 🌐 MediTrack Web

Interfaz web de **MediTrack**, la aplicación para llevar el control de medicamentos: registrar tratamientos, ver qué dosis tocan, marcarlas como tomadas u omitidas, consultar alergias y generar una tarjeta de emergencia. También permite que un **cuidador** gestione a personas a su cargo.

Está hecha con **Astro + React + Tailwind CSS** y se comunica con la API de [`meditrack-backend`](../meditrack-backend).

## 🧭 ¿Qué hay en la web?

| Página | Ruta | Para qué sirve |
|---|---|---|
| Inicio | `/` | Redirige a `/login` |
| Registro / Login | `/register`, `/login` | Crear cuenta e iniciar sesión |
| Recuperar contraseña | `/forgot-password`, `/reset-password` | Pedir y usar el enlace de recuperación |
| Panel principal | `/dashboard` | Tratamientos, dosis del día, alergias, tarjeta de emergencia |
| Activar cuenta | `/claim-account` | Una persona a cargo canjea su código de invitación |
| Política de monitoreo por cuidadores | `/caregiver-consent` | Texto legal sobre qué puede ver un cuidador |
| Política de privacidad | `/privacy-policy` | Texto legal |
| Administración | `/admin` | Solo rol `ADMIN`: usuarios, uso de la plataforma, políticas |

## 🚀 Empezar a desarrollar

**Necesitas:** Node.js 22.12 o superior y [pnpm](https://pnpm.io). Además, el backend corriendo en `http://localhost:8080` (mira cómo en [`meditrack-infra`](../meditrack-infra)).

```bash
cp .env.example .env      # define BACKEND_URL (por defecto http://localhost:8080)
pnpm install
pnpm dev                  # http://localhost:4321
```

El servidor de desarrollo **redirige las llamadas `/api` al backend** (ver `astro.config.mjs`), así que no necesitas configurar CORS ni URLs en el código.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala las dependencias |
| `pnpm dev` | Servidor de desarrollo en `localhost:4321` |
| `pnpm build` | Genera el sitio de producción en `./dist/` |
| `pnpm preview` | Sirve el build para probarlo antes de desplegar |
| `pnpm astro check` | Revisa los tipos de TypeScript |

## 🔧 Variables de entorno

| Variable | Dónde se usa | Para qué |
|---|---|---|
| `BACKEND_URL` | Solo `pnpm dev` | A dónde redirige el servidor de desarrollo las llamadas `/api` |

En **producción no hay variables**: la web son archivos estáticos y nginx (en `meditrack-infra`) se encarga de enviar `/api` al backend. Por eso no hay secretos en este repositorio.

## 📁 Estructura

```text
meditrack-web/
├── src/
│   ├── pages/        # Una página por ruta (.astro)
│   ├── components/   # Componentes React: formularios, Dashboard, AdminDashboard…
│   │   └── dashboard/    # Piezas del panel principal
│   ├── layouts/      # Plantilla común (Layout.astro)
│   ├── lib/          # Lógica compartida: api.ts, session.ts, date.ts, notificaciones…
│   └── styles/       # Estilos globales (Tailwind)
├── public/           # Archivos estáticos
├── e2e/              # Pruebas de extremo a extremo con Playwright
├── nginx/default.conf    # Configuración del nginx que sirve el build
└── Dockerfile        # Compila con Node y sirve con nginx
```

## 🧪 Pruebas end-to-end

Las pruebas viven en [`e2e/`](./e2e) y usan **Playwright** contra el stack completo. Cada prueba se ejecuta en tres zonas horarias (`America/Bogota`, `Europe/Madrid`, `UTC`) para asegurar que las horas se muestran bien en cualquier lugar.

```bash
# 1. Levanta el stack completo (desde meditrack-infra)
cd ../meditrack-infra
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build

# 2. Ejecuta las pruebas
cd ../meditrack-web/e2e
npm install        # solo la primera vez
npm test
npm run report     # abre el informe HTML
```

> Más detalles y opciones en [`e2e/README.md`](./e2e/README.md).

## 🐳 Docker y despliegue

El `Dockerfile` hace dos etapas: compila con Node + pnpm y copia el resultado a un nginx liviano. Cada `push` a `main` ejecuta el build y publica la imagen `<usuario>/meditrack-web:<AAAAMMDD-sha7>` en Docker Hub (ver `.github/workflows/docker-publish.yml`). El despliegue lo gestiona [`meditrack-infra`](../meditrack-infra).

## 📚 Documentación útil

- [Astro](https://docs.astro.build) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com/docs)
