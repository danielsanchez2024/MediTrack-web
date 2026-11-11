export type DayOption = 'yesterday' | 'today' | 'tomorrow';

const OPTIONS: { value: DayOption; label: string }[] = [
  { value: 'yesterday', label: 'Ayer' },
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' }
];

interface DaySelectorProps {
  value: DayOption;
  onChange: (value: DayOption) => void;
}

export default function DaySelector({ value, onChange }: DaySelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-card p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            value === option.value
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:bg-surface-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
