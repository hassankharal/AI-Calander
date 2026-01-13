/**
 * Generates a stable unique ID.
 * Uses crypto.randomUUID if available (Node/modern environments),
 * otherwise falls back to a timestamp + random string combination.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
