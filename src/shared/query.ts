// Shared helpers for list endpoints.
// Referenced by every list endpoint; see
// .agents/rules/skills/list-endpoint-pagination-filter-sort/SKILL.md.

import { isValidUuid } from './validation';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

// DECISION (recorded in docs/api.md):
// Pagination is offset-based (`limit` + `offset`) and is applied identically
// to every list endpoint. `limit` defaults to 20 (max 100); `offset` defaults
// to 0. Out-of-range or non-integer values are rejected with 400, never
// clamped and never a 500 (data-integrity.md).

export type FilterMode = 'exact' | 'contains' | 'uuid' | 'date';

export interface FilterFieldDef {
  // API (camelCase) query-parameter name, e.g. "name" or "departureTime".
  field: string;
  // How the value is validated and matched against the database column.
  mode: FilterMode;
}

export interface SortableFieldDef {
  // API (camelCase) `sort` value, e.g. "departureTime".
  field: string;
}

export interface ListParams {
  limit: number;
  offset: number;
  filters: Array<{ field: string; value: string }>;
  // Null means "no sort requested" — the data layer applies its default order.
  sort: { field: string; direction: 'asc' | 'desc' } | null;
}

export type ListQueryResult =
  | { ok: true; params: ListParams }
  | { ok: false; error: string };

function isNonNegativeInteger(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d+$/.test(raw.trim());
}

export function parseLimit(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_PAGE_LIMIT;
  if (!isNonNegativeInteger(raw)) return null;
  const n = Number(raw);
  if (n < 1 || n > MAX_PAGE_LIMIT) return null;
  return n;
}

export function parseOffset(raw: unknown): number | null {
  if (raw === undefined) return 0;
  if (!isNonNegativeInteger(raw)) return null;
  return Number(raw);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateValue(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseListQuery(
  query: Record<string, unknown>,
  filterFields: FilterFieldDef[],
  sortableFields: SortableFieldDef[],
): ListQueryResult {
  const allowedFilter = new Map(filterFields.map((f) => [f.field, f.mode]));
  const allowedSort = new Set(sortableFields.map((s) => s.field));

  for (const key of Object.keys(query)) {
    if (['limit', 'offset', 'sort', 'order'].includes(key)) continue;
    if (!allowedFilter.has(key)) {
      return { ok: false, error: `Unsupported query parameter "${key}"` };
    }
  }

  const limit = parseLimit(query.limit);
  if (limit === null) {
    return { ok: false, error: `"limit" must be an integer between 1 and ${MAX_PAGE_LIMIT}` };
  }

  const offset = parseOffset(query.offset);
  if (offset === null) {
    return { ok: false, error: '"offset" must be a non-negative integer' };
  }

  const filters: ListParams['filters'] = [];
  for (const [field, mode] of allowedFilter) {
    const raw = query[field];
    if (raw === undefined) continue;
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { ok: false, error: `Invalid value for filter "${field}"` };
    }
    if (mode === 'uuid' && !isValidUuid(raw)) {
      return { ok: false, error: `Filter "${field}" must be a valid UUID` };
    }
    if (mode === 'date' && !isValidDateValue(raw)) {
      return { ok: false, error: `Filter "${field}" must be in YYYY-MM-DD format` };
    }
    filters.push({ field, value: raw });
  }

  const rawSort = query.sort;
  if (rawSort === undefined) {
    if (query.order !== undefined) {
      return { ok: false, error: '"order" requires a "sort" field' };
    }
    return { ok: true, params: { limit, offset, filters, sort: null } };
  }

  if (typeof rawSort !== 'string' || !allowedSort.has(rawSort)) {
    return { ok: false, error: `Unsupported sort field "${String(rawSort)}"` };
  }

  let direction: 'asc' | 'desc' = 'asc';
  if (query.order !== undefined) {
    if (query.order !== 'asc' && query.order !== 'desc') {
      return { ok: false, error: '"order" must be "asc" or "desc"' };
    }
    direction = query.order;
  }

  return {
    ok: true,
    params: {
      limit,
      offset,
      filters,
      sort: { field: rawSort, direction },
    },
  };
}