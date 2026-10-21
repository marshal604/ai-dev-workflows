/** Taiwan postal codes have 3, 5 (3+2) or 6 (3+3) digits. */
export function isValidPostalCode(code: string): boolean {
  return /^\d{3}(\d{2})?$/.test(code.trim());
}
