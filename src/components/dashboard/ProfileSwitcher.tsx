import { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';
import type { ProfileSummary } from '../../lib/api';

interface ProfileSwitcherProps {
  profiles: ProfileSummary[];
  activeProfileId: string;
  onChange: (profileId: string) => void;
}

export default function ProfileSwitcher({ profiles, activeProfileId, onChange }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const active = profiles.find((profile) => profile.id === activeProfileId);

  if (profiles.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg border border-warning-bg-soft bg-warning-bg px-3 py-2 text-sm font-semibold text-text"
      >
        <User className="h-4 w-4 text-warning" strokeWidth={1.75} />
        Viendo perfil de: {active?.name ?? '—'}
        <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute left-0 z-10 mt-2 w-64 rounded-lg border border-border bg-surface-card p-1 shadow-md">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => {
                onChange(profile.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                profile.id === activeProfileId ? 'font-semibold text-primary' : 'text-text'
              }`}
            >
              {profile.name}
              {profile.id === activeProfileId && (
                <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-secondary">
                  Activo
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
