// Loose on purpose (the backend doesn't validate phones at all): digits plus the usual
// separators, with at least 7 digits — enough to catch typos without rejecting real local or
// international formats. Same rule as the mobile app's isValidPhone.
export function isValidPhone(phone: string): boolean {
  const text = phone.trim();
  if (!/^\+?[0-9 ()-]+$/.test(text)) return false;
  return (text.match(/[0-9]/g) ?? []).length >= 7;
}
