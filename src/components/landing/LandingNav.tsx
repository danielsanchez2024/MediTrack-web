import { useEffect, useState } from 'react';
import { Menu, X, HeartPulse } from 'lucide-react';

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#privacidad', label: 'Privacidad' },
  { href: '#preguntas', label: 'Preguntas' }
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || open ? 'border-b border-border bg-white/85 shadow-sm backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Principal">
        <a href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-primary to-secondary text-white">
            <HeartPulse className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          MediTrack
        </a>

        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-sm font-semibold text-text-secondary transition-colors hover:text-primary">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <a href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-info">
            Iniciar sesión
          </a>
          <a
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary-hover"
          >
            Crear cuenta
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div id="landing-mobile-menu" className="border-t border-border bg-white px-4 pb-5 pt-3 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-[15px] font-semibold text-text-secondary hover:bg-surface-muted"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="/login" className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-semibold text-primary">
              Iniciar sesión
            </a>
            <a href="/register" className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
              Crear cuenta
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
