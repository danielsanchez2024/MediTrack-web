import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ITEMS = [
  {
    q: '¿Qué pasa con la foto de mi fórmula?',
    a: 'MediTrack no la guarda: solo conserva los medicamentos que tú revisas y confirmas. Para leerla, la foto se envía a un servicio externo de inteligencia artificial, y antes de subirla puedes recortarla para que tu nombre y tu documento no salgan de tu teléfono. El escaneo es opcional: siempre puedes ingresar tus medicamentos a mano.'
  },
  {
    q: '¿La lectura con inteligencia artificial puede equivocarse?',
    a: 'Sí, por eso nunca guardamos nada automáticamente. Cada medicamento detectado aparece en un formulario editable para que lo compares con tu fórmula y lo corrijas antes de confirmar.'
  },
  {
    q: '¿Quién puede ver mis datos de salud?',
    a: 'Solo tú. Un cuidador únicamente los ve si tú lo autorizas, o si tu perfil lo creó él y todavía no tienes cuenta propia. Ese permiso lo puedes retirar cuando quieras. No vendemos ni cedemos tus datos de salud con fines comerciales.'
  },
  {
    q: '¿Puedo gestionar los medicamentos de un familiar?',
    a: 'Sí. Creas un perfil para esa persona y gestionas sus tratamientos desde tu cuenta. Si más adelante quiere tener su propia cuenta, le envías un código de invitación y ella decide si te sigue dando acceso.'
  },
  {
    q: '¿MediTrack reemplaza a mi médico?',
    a: 'No. Es una herramienta para organizar tus medicamentos y recordarte las tomas. Las indicaciones, dosis y cambios de tratamiento siempre los define tu profesional de salud.'
  },
  {
    q: '¿Funciona en el celular?',
    a: 'Sí. La web está pensada para usarse cómoda desde el teléfono, y desde ahí también puedes tomar la foto de tu fórmula.'
  }
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {ITEMS.map((item, index) => {
        const isOpen = open === index;
        return (
          <div
            key={item.q}
            className={`rounded-2xl border bg-white transition-shadow ${isOpen ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-border'}`}
          >
            <h3>
              <button
                type="button"
                id={`faq-button-${index}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-[15px] font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {item.q}
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-button-${index}`}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-text-secondary">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
