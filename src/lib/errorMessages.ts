// The backend's error messages are in English (see meditrack-backend's DTOs/exceptions).
// This maps the ones the login/auth screens can actually see to their Spanish copy; anything
// unrecognized falls back to a generic message rather than leaking raw backend text.
const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid email or password': 'Email o contraseña incorrectos.',
  'A user with this email already exists': 'Ya existe una cuenta con este correo electrónico.',
  'Name is required': 'El nombre es obligatorio.',
  'Email is required': 'El correo electrónico es obligatorio.',
  'Email format is invalid': 'El formato del correo electrónico no es válido.',
  'A phone number is required to receive SMS reminders': 'Escribe tu número de teléfono para recibir avisos por SMS.',
  'Phone number format is invalid': 'El número de teléfono no es válido.',
  'Password is required': 'La contraseña es obligatoria.',
  'Password must be at least 8 characters long': 'La contraseña debe tener al menos 8 caracteres.',
  'Password confirmation is required': 'Debes confirmar la contraseña.',
  'Password and confirmation do not match': 'Las contraseñas no coinciden.',
  'You must accept the health data processing consent to register':
    'Debes aceptar el tratamiento de datos de salud para registrarte.',
  'Invalid or expired password reset link': 'Este enlace ya no es válido o expiró. Solicita uno nuevo.',
  'Reset token is required': 'Este enlace no es válido. Solicita uno nuevo.',
  'Invalid or expired invite code': 'Este código de invitación no es válido o expiró.',
  'Claim token is required': 'Debes ingresar el código de invitación.',
  'An active treatment for this medication already exists. Update it instead of creating a new one.':
    'Ya existe un tratamiento activo con este medicamento. Edítalo en vez de crear uno nuevo.',
  'A dose scheduled in the future cannot already be marked as taken':
    'Una dosis programada en el futuro no puede estar marcada como ya tomada.',
  'The first dose date cannot be in the past unless it was already taken':
    'La fecha de la primera dosis no puede estar en el pasado, a menos que marques que ya se tomó.',
  'Total quantity must be enough to cover at least one dose':
    'La cantidad total debe alcanzar al menos para una toma.',
  'Could not read the prescription image. Please try again or enter the treatment manually.':
    'No pudimos leer la fórmula. Intenta con otra foto o ingresa el medicamento manualmente.',
  'This profile has already been claimed': 'Esta persona ya reclamó su propia cuenta, ya no necesita una invitación.',
  'Description is required': 'La descripción es obligatoria.',
  'You cannot deactivate your own account': 'No puedes desactivar tu propia cuenta.',
  'You cannot remove your own admin role': 'No puedes quitarte a ti mismo el rol de administrador.',
  'Version is required': 'La versión es obligatoria.',
  'Policy type is required': 'El tipo de política es obligatorio.',
  'User not found': 'Este usuario ya no existe. Actualiza la lista.',
  // Now a 400 form error (it used to be a 401 that logged the user out).
  'Current password is incorrect': 'La contraseña actual no es correcta.',
  'Current password is required': 'Ingresa tu contraseña actual.',
  'Name must be at most 150 characters': 'El nombre puede tener como máximo 150 caracteres.',
  // 403 once a dependent who claimed their own account hasn't granted (or withdrew) access.
  'This person has not granted you access to their data.':
    'Esta persona ya tiene su propia cuenta y no te ha dado acceso a sus datos.',
  'Medication name is required': 'El nombre del medicamento es obligatorio.',
  'Dosage is required': 'La dosis es obligatoria.',
  'Frequency value is required': 'La frecuencia es obligatoria.',
  'Frequency must be a positive number': 'La frecuencia debe ser un número mayor que 0.',
  'Total quantity must be a positive number': 'La cantidad suministrada debe ser mayor que 0.',
  'Quantity per dose must be a positive number': 'La cantidad por toma debe ser mayor que 0.',
  'The daily limit of AI prescription scans has been reached. Try again tomorrow or enter the treatment manually.':
    'Se alcanzó el límite diario de lecturas de fórmulas. Intenta mañana o ingresa el medicamento manualmente.',
  'You have reached your daily limit of AI prescription scans. Try again tomorrow or enter the treatment manually.':
    'Alcanzaste tu límite diario de lecturas de fórmulas. Intenta mañana o ingresa el medicamento manualmente.',
  'Too many prescriptions are being read right now. Please try again in a minute or enter the treatment manually.':
    'Se están leyendo muchas fórmulas en este momento. Intenta de nuevo en un minuto o ingresa el medicamento manualmente.',
  'Too many prescriptions are being read right now. Please try again in a moment or enter the treatment manually.':
    'Se están leyendo muchas fórmulas en este momento. Intenta de nuevo en un momento o ingresa el medicamento manualmente.',
  'The uploaded file is too large': 'La foto es demasiado pesada. Prueba con una imagen más pequeña o recórtala.',
  'Too many requests. Please try again later.': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
  // Features an admin paused from the operations panel.
  'New registrations are temporarily paused. Please try again later.':
    'Los registros nuevos están pausados temporalmente. Intenta de nuevo más tarde.',
  'Prescription scanning is temporarily unavailable. Please enter the treatment manually.':
    'La lectura de fórmulas no está disponible por ahora. Ingresa el medicamento manualmente.',
  'A reason is required to turn a switch off': 'Escribe el motivo para apagar un interruptor.',
  'Unknown switch': 'Ese interruptor no existe.'
};

// Some backend messages embed a dynamic value (a timestamp) and can't be matched exactly —
// matched by prefix instead, in the order given.
const KNOWN_MESSAGE_PREFIXES: [string, string][] = [
  [
    'You must record doses in order',
    'Hay una dosis anterior de este medicamento sin resolver. Regístrala primero y luego esta se habilitará.'
  ],
  [
    'This dose was recorded more than',
    'Ya pasó el tiempo permitido para corregir esta toma.'
  ],
  // Carries the profile id — a deleted dependent, or one that was never yours.
  ['Profile not found', 'Este perfil ya no existe o no tienes acceso a él.'],
  ['Invalid time zone', 'La zona horaria de tu dispositivo no es válida.'],
  // Backend refused the scan because the consent to share the photo did not arrive.
  ['This prescription reader', 'Debes aceptar que la foto se envíe al servicio de lectura para continuar.'],
  [
    "This dose can't be recorded yet",
    'Todavía no es hora de registrar esta toma — se habilita 10 minutos antes.'
  ]
];

export function toSpanishMessage(message: string): string {
  if (KNOWN_MESSAGES[message]) return KNOWN_MESSAGES[message];
  const prefixMatch = KNOWN_MESSAGE_PREFIXES.find(([prefix]) => message.startsWith(prefix));
  return prefixMatch?.[1] ?? 'Ocurrió un error. Intenta de nuevo en un momento.';
}

// Validation errors come back as `details: string[]` alongside a generic top-level message
// ("One or more fields are invalid") — translate each one and join, deduplicating repeats.
export function toSpanishMessages(details: string[]): string {
  const translated = Array.from(new Set(details.map(toSpanishMessage)));
  return translated.join(' ');
}
