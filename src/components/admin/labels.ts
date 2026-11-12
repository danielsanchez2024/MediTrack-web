import type { OpsRange } from '../../lib/api';

export const RANGES: { id: OpsRange; label: string; hours: number }[] = [
  { id: '1h', label: 'Última hora', hours: 1 },
  { id: '6h', label: '6 horas', hours: 6 },
  { id: '24h', label: '24 horas', hours: 24 },
  { id: '7d', label: '7 días', hours: 168 },
  { id: '30d', label: '30 días', hours: 720 }
];

export const rangeHours = (range: OpsRange) => RANGES.find((r) => r.id === range)?.hours ?? 1;

export const SWITCH_INFO: Record<string, { label: string; effect: string }> = {
  AI_SCAN: {
    label: 'Lectura de fórmulas con IA',
    effect: 'Nadie puede escanear una fórmula y ninguna foto se envía al proveedor. Los usuarios ven el aviso y pueden ingresar el medicamento a mano.'
  },
  REGISTRATION: {
    label: 'Registro de cuentas nuevas',
    effect: 'No se pueden crear cuentas nuevas. Quien ya tiene cuenta sigue usando MediTrack con normalidad.'
  },
  EMAIL_REMINDERS: {
    label: 'Recordatorios por correo',
    effect: 'No se envían correos de recordatorio de dosis, y los que se salten no se reenvían después. Los correos de recuperación de contraseña no se tocan.'
  },
  SMS_REMINDERS: {
    label: 'Recordatorios por SMS',
    effect: 'No se envían SMS de recordatorio, y los que se salten no se reenvían después.'
  }
};

export const AUDIT_ACTIONS: Record<string, string> = {
  SWITCH_OFF: 'Pausó',
  SWITCH_ON: 'Reactivó',
  USER_DEACTIVATED: 'Desactivó la cuenta',
  USER_REACTIVATED: 'Reactivó la cuenta',
  ROLE_CHANGED: 'Cambió el rol de',
  POLICY_PUBLISHED: 'Publicó la política'
};

export function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
