import { useState } from 'react';
import { Check, Pill, Bell, ScanLine, RotateCcw } from 'lucide-react';

interface Dose {
  id: string;
  name: string;
  detail: string;
  time: string;
  taken: boolean;
}

// Made-up example data: this is a demo, not anyone's real schedule.
const INITIAL: Dose[] = [
  { id: 'a', name: 'Losartán', detail: '50 mg · 1 tableta', time: '8:00 a. m.', taken: true },
  { id: 'b', name: 'Metformina', detail: '850 mg · 1 tableta', time: '1:00 p. m.', taken: false },
  { id: 'c', name: 'Atorvastatina', detail: '20 mg · 1 tableta', time: '9:00 p. m.', taken: false }
];

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The first thing a visitor sees: a phone-like card they can actually tap. Marking a dose moves the
// adherence ring, which is the app's core idea in one gesture.
export default function HeroDemo() {
  const [doses, setDoses] = useState<Dose[]>(INITIAL);

  const takenCount = doses.filter((dose) => dose.taken).length;
  const percent = Math.round((takenCount / doses.length) * 100);
  const nextId = doses.find((dose) => !dose.taken)?.id;
  const allDone = takenCount === doses.length;

  function markTaken(id: string) {
    setDoses((current) => current.map((dose) => (dose.id === id ? { ...dose, taken: true } : dose)));
  }

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="anim-float absolute -left-8 -top-4 z-10 hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-secondary shadow-lg sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-bg text-success">
          <Bell className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        Recordatorio enviado
      </div>
      <div className="anim-float-slow absolute -bottom-6 -right-6 z-10 hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-secondary shadow-lg sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-info text-primary">
          <ScanLine className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        Fórmula leída
      </div>

      <div className="rounded-[2.25rem] border border-border bg-white p-4 shadow-2xl shadow-primary/15">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-surface-muted" aria-hidden="true" />

        <div className="flex items-center gap-4 rounded-2xl bg-linear-to-br from-primary to-secondary p-4 text-white">
          <div className="relative h-21 w-21 shrink-0">
            <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="8" />
              <circle
                cx="42"
                cy="42"
                r={RADIUS}
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" aria-live="polite">
              {percent}%
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Adherencia de hoy</p>
            <p className="mt-0.5 text-lg font-bold leading-tight">
              {allDone ? '¡Día completo!' : `${takenCount} de ${doses.length} tomas`}
            </p>
            <p className="mt-0.5 text-xs text-white/80">
              {allDone ? 'Así se construye un buen hábito.' : 'Toca “Registrar” en la próxima dosis.'}
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2.5">
          {doses.map((dose) => {
            const isNext = dose.id === nextId;
            return (
              <li
                key={dose.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  dose.taken ? 'border-success-soft bg-success-bg' : isNext ? 'border-primary/30 bg-surface-info' : 'border-border bg-white'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    dose.taken ? 'bg-success text-white' : 'bg-surface-muted text-primary'
                  }`}
                >
                  <Pill className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">{dose.name}</p>
                  <p className="truncate text-xs text-text-caption">
                    {dose.detail} · {dose.time}
                  </p>
                </div>
                {dose.taken ? (
                  <span key="done" className="anim-pop flex items-center gap-1 text-xs font-bold text-success">
                    <Check className="h-4 w-4" strokeWidth={3} /> Tomada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => markTaken(dose.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      isNext ? 'anim-pulse-ring bg-primary hover:bg-primary-hover' : 'bg-text-muted hover:bg-text-caption'
                    }`}
                  >
                    Registrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-text-caption">
          <span>Demo con datos de ejemplo</span>
          <button
            type="button"
            onClick={() => setDoses(INITIAL)}
            className="flex items-center gap-1 font-semibold text-text-secondary hover:text-primary"
          >
            <RotateCcw className="h-3 w-3" /> Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
