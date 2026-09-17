import type { FilterFieldDef, SortableFieldDef } from '../../shared/query';
import { isValidUuid } from '../../shared/validation';

export type ValidationError = { code: string; message: string } | null;

// Allowed list-endpoint filter and sort parameters (list-endpoint-pagination-
// filter-sort skill). Values are camelCase API names; columns are snake_case.
export const AIRLINE_FILTER_FIELDS: FilterFieldDef[] = [
  { field: 'name', mode: 'contains' },
  { field: 'code', mode: 'exact' },
  { field: 'country', mode: 'exact' },
];

export const AIRLINE_SORTABLE_FIELDS: SortableFieldDef[] = [
  { field: 'name' },
  { field: 'code' },
  { field: 'country' },
  { field: 'id' },
];

export function validateAirlineBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.name !== 'string' || b.name.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "name" is required and must be a non-empty string' };
  }
  if (typeof b.code !== 'string' || b.code.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "code" is required and must be a non-empty string' };
  }
  if (typeof b.country !== 'string' || b.country.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "country" is required and must be a non-empty string' };
  }
  return null;
}

export function validateAirlineUpdateBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const allowed = ['name', 'code', 'country'];
  const keys = Object.keys(b);
  if (keys.length === 0) {
    return { code: 'BAD_REQUEST', message: 'At least one field must be provided for update' };
  }
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return { code: 'BAD_REQUEST', message: `Unexpected field "${key}"` };
    }
    if (typeof b[key] !== 'string' || (b[key] as string).trim() === '') {
      return { code: 'BAD_REQUEST', message: `Field "${key}" must be a non-empty string` };
    }
  }
  return null;
}