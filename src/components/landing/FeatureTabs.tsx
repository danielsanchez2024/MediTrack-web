import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ScanLine, Bell, Users, Siren, Check, Download, Phone, ShieldCheck } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
  title: string;
  text: string;
  points: string[];
  mock: ReactNode;
}

function ScanMock() {
  return (
    <div className="grid grid-cols-5 gap-3">
      <div className="relative col-span-3 overflow-hidden rounded-xl border border-border bg-white p-4" aria-hidden="true">
        <div className="mb-3 h-2 w-2/5 rounded bg-surface-muted" />
        <div className="mb-4 h-2 w-3/5 rounded bg-surface-muted" />
        <div className="mb-2 rounded-md bg-surface-info px-2 py-1.5">
          <div className="h-2 w-4/5 rounded bg-primary/40" />
        </div>
        <div className="mb-4 h-2 w-2/3 rounded bg-surface-muted" />
        <div className="mb-2 rounded-md bg-surface-info px-2 py-1.5">
          <div className="h-2 w-3/4 rounded bg-primary/40" />
        </div>
        <div className="mb-2 h-2 w-1/2 rounded bg-surface-muted" />
        <div className="h-2 w-3/5 rounded bg-surface-muted" />
        <div className="anim-scan absolute inset-x-0 h-0.5 bg-secondary shadow-[0_0_12px_3px_rgb(45_159_131/0.5)]" />
      </div>
      <div className="col-span-2 flex flex-col justify-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-caption">Detectamos</p>
        {['Losartán 50 mg', 'Metformina 850 mg'].map((name) => (
          <div key={name} className="flex items-center gap-1.5 rounded-lg bg-success-bg px-2.5 py-2 text-xs font-bold text-text">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />
            {name}
          </div>
        ))}
        <p className="text-[11px] leading-snug text-text-caption">Tú revisas y corriges todo antes de guardar.</p>
      </div>
    </div>
  );
}

function ReminderMock() {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-text-caption">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
          <Bell className="h-3 w-3" />
        </span>
        MediTrack · ahora
      </div>
      <p className="text-sm font-bold text-text">Es hora de una dosis</p>
      <p className="mt-1 text-sm text-text-secondary">
        Es hora de que <strong>Ana</strong> tome <strong>Losartán</strong> (1 tableta).
      </p>
      <span className="mt-3 inline-block rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white">Registrar esta toma</span>
      <p className="mt-3 text-[11px] text-text-caption">También te avisamos unos minutos antes de cada dosis.</p>
    </div>
  );
}

function CaregiverMock() {
  const [allowed, setAllowed] = useState(true);
  return (
    <div className="flex flex-col gap-2.5">
      {[
        { name: 'Tú', note: 'Tu propio perfil', tone: 'bg-surface-info text-primary' },
        { name: 'Mamá (María)', note: 'Perfil que tú gestionas', tone: 'bg-success-bg text-success' }
      ].map((profile) => (
        <div key={profile.name} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${profile.tone}`}>
            {profile.name[0]}
          </span>
          <div>
            <p className="text-sm font-bold text-text">{profile.name}</p>
            <p className="text-xs text-text-caption">{profile.note}</p>
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-bg-soft text-sm font-bold text-warning">L</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-text">Abuelo (Luis)</p>
            <p className="text-xs text-text-caption">Ya tiene su propia cuenta</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowed}
            aria-label="Permiso de monitoreo de Luis"
            onClick={() => setAllowed((value) => !value)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              allowed ? 'bg-success' : 'bg-text-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${allowed ? 'left-5.5' : 'left-0.5'}`}
            />
          </button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-text-secondary" aria-live="polite">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {allowed ? 'Luis te dio permiso: puedes ver y registrar sus tomas.' : 'Sin permiso de Luis no ves sus datos. Él decide, y puede cambiarlo cuando quiera.'}
        </p>
      </div>
      <p className="text-[11px] text-text-caption">Pruébalo: toca el interruptor.</p>
    </div>
  );
}

function EmergencyMock() {
  return (
    <div className="rounded-xl border-2 border-danger/30 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-danger-strong">
          <Siren className="h-4 w-4" /> Ficha de emergencia
        </p>
        <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-bold text-danger-strong">PDF</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-caption">Alergias</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-danger-bg-soft px-2.5 py-1 text-xs font-bold text-danger-strong">Penicilina · Severa</span>
        <span className="rounded-full bg-warning-bg-soft px-2.5 py-1 text-xs font-bold text-warning">Ibuprofeno · Moderada</span>
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-text-caption">Medicamentos actuales</p>
      <p className="mt-1 text-xs text-text-secondary">Losartán 50 mg · Metformina 850 mg</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        <Phone className="h-3.5 w-3.5 text-primary" /> Contacto de emergencia incluido
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">
        <Download className="h-3.5 w-3.5" /> Descargar ficha
      </span>
    </div>
  );
}

const TABS: Tab[] = [
  {
    id: 'escanear',
    label: 'Escanear fórmula',
    icon: <ScanLine className="h-4 w-4" />,
    title: 'Fotografía tu fórmula y listo',
    text: 'Dejamos de lado el tecleo: lees la foto con inteligencia artificial y te proponemos cada medicamento, su dosis y su frecuencia.',
    points: [
      'Detecta varios medicamentos de una sola fórmula',
      'Tú revisas y editas todo antes de guardar',
      'Puedes recortar la foto para enviar solo los medicamentos'
    ],
    mock: <ScanMock />
  },
  {
    id: 'recordatorios',
    label: 'Recordatorios',
    icon: <Bell className="h-4 w-4" />,
    title: 'Un aviso justo cuando toca',
    text: 'Calculamos solos el calendario de tomas según la frecuencia y te avisamos por correo antes y en el momento de cada dosis.',
    points: [
      'Elige si los quieres antes, a la hora o en ambos momentos',
      'Registra cada toma como tomada u omitida',
      'Mira tu adherencia de un día o de un rango de fechas'
    ],
    mock: <ReminderMock />
  },
  {
    id: 'cuidadores',
    label: 'Cuidadores',
    icon: <Users className="h-4 w-4" />,
    title: 'Cuida de los tuyos, con permiso',
    text: 'Gestiona los tratamientos de tus padres, hijos o pacientes desde tu cuenta. Cuando alguien crea su propia cuenta, decide si te deja seguir viendo sus datos.',
    points: [
      'Perfiles de dependientes en un solo lugar',
      'Invitación para que cada persona reclame su cuenta',
      'El permiso de monitoreo se puede retirar en cualquier momento'
    ],
    mock: <CaregiverMock />
  },
  {
    id: 'emergencia',
    label: 'Emergencia',
    icon: <Siren className="h-4 w-4" />,
    title: 'Tu información clave, a mano',
    text: 'Genera una ficha de emergencia en PDF con tus alergias, tus medicamentos actuales y tu contacto de emergencia, para mostrarla cuando más importa.',
    points: ['Alergias con su severidad', 'Medicamentos actuales siempre al día', 'Un PDF listo para imprimir o compartir'],
    mock: <EmergencyMock />
  }
];

// WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
export default function FeatureTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    setActive(TABS[next].id);
    buttons.current[TABS[next].id]?.focus();
  }

  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];

  return (
    <div>
      <div role="tablist" aria-label="Funciones de MediTrack" className="flex flex-wrap justify-center gap-2">
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[tab.id] = element;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => handleKey(event, index)}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'border border-border bg-white text-text-secondary hover:border-primary/40 hover:text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        key={current.id}
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
        className="anim-pop mt-8 grid items-center gap-8 rounded-3xl border border-border bg-white p-6 shadow-xl shadow-primary/5 md:grid-cols-2 md:p-10"
      >
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-text">{current.title}</h3>
          <p className="mt-3 leading-relaxed text-text-secondary">{current.text}</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {current.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm font-medium text-text-secondary">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface-info p-5">{current.mock}</div>
      </div>
    </div>
  );
}
