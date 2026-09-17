import type { FilterFieldDef, SortableFieldDef } from '../../shared/query';

export type ValidationError = { code: string; message: string } | null;

// Allowed list-endpoint filter and sort parameters (list-endpoint-pagination-
// filter-sort skill). Values are camelCase API names; columns are snake_case.
export const CUSTOMER_FILTER_FIELDS: FilterFieldDef[] = [
  { field: 'fullName', mode: 'contains' },
  { field: 'email', mode: 'contains' },
];

export const CUSTOMER_SORTABLE_FIELDS: SortableFieldDef[] = [
  { field: 'fullName' },
  { field: 'email' },
  { field: 'id' },
];

export function validateCustomerBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.fullName !== 'string' || b.fullName.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "fullName" is required and must be a non-empty string' };
  }
  if (typeof b.email !== 'string' || b.email.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "email" is required and must be a non-empty string' };
  }
  if (b.phoneNumber !== undefined && b.phoneNumber !== null && typeof b.phoneNumber !== 'string') {
    return { code: 'BAD_REQUEST', message: 'Field "phoneNumber" must be a string if provided' };
  }
  return null;
}

export function validateCustomerUpdateBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const allowed = ['fullName', 'email', 'phoneNumber'];
  const keys = Object.keys(b);
  if (keys.length === 0) {
    return { code: 'BAD_REQUEST', message: 'At least one field must be provided for update' };
  }
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return { code: 'BAD_REQUEST', message: `Unexpected field "${key}"` };
    }
  }
  if (b.fullName !== undefined && (typeof b.fullName !== 'string' || (b.fullName as string).trim() === '')) {
    return { code: 'BAD_REQUEST', message: 'Field "fullName" must be a non-empty string' };
  }
  if (b.email !== undefined && (typeof b.email !== 'string' || (b.email as string).trim() === '')) {
    return { code: 'BAD_REQUEST', message: 'Field "email" must be a non-empty string' };
  }
  if (b.phoneNumber !== undefined && b.phoneNumber !== null && typeof b.phoneNumber !== 'string') {
    return { code: 'BAD_REQUEST', message: 'Field "phoneNumber" must be a string if provided' };
  }
  return null;
}