/** Taiwan postal codes have 3, 5 (3+2) or 6 (3+3) digits. */
export function isValidPostalCode(code: string): boolean {
  return /^\d{3}(\d{2,3})?$/.test(code.trim());
}

/** Formats a postal code for display: digits only, no surrounding spaces. */
export function formatPostalCode(code: string): string {
  return code.trim();
}
