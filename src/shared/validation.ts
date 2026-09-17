const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Express 5 types route params as string | string[]; route-relevant params are
// scalars, so collapse to a plain string (or null when malformed/absent).
export function toIdParam(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}