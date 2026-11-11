// A simple, transparent rule-based score — not a real entropy estimate (that would need a
// library like zxcvbn) but enough to nudge people away from short, single-character-class
// passwords without pretending to be more rigorous than it is.
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function scorePassword(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password)
  ).length;
  if (varietyCount >= 3) score++;
  if (varietyCount === 4) score++;

  const clampedScore = Math.min(score, 4) as PasswordStrength['score'];

  const labels: Record<PasswordStrength['score'], string> = {
    0: 'Muy débil',
    1: 'Débil',
    2: 'Aceptable',
    3: 'Fuerte',
    4: 'Muy fuerte'
  };

  return { score: clampedScore, label: labels[clampedScore] };
}
