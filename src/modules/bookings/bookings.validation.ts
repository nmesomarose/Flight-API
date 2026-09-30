import type { FilterFieldDef, SortableFieldDef } from '../../shared/query';
import { isValidUuid } from '../../shared/validation';

export type ValidationError = { code: string; message: string } | null;

// Upper bound for `seatsBooked`, matching the range of the backing column:
// Postgres `integer` holds -2147483648..2147483647, and the field is validated
// as positive, so 2147483647 is the largest acceptable value.
const MAX_SEATS_BOOKED = 2147483647;

// Allowed list-endpoint filter and sort parameters (list-endpoint-pagination-
// filter-sort skill). Values are camelCase API names; columns are snake_case.
export const BOOKING_FILTER_FIELDS: FilterFieldDef[] = [
  { field: 'customerId', mode: 'uuid' },
  { field: 'flightId', mode: 'uuid' },
];

export const BOOKING_SORTABLE_FIELDS: SortableFieldDef[] = [
  { field: 'customerId' },
  { field: 'flightId' },
  { field: 'bookingTimestamp' },
  { field: 'seatsBooked' },
  { field: 'id' },
];

export function validateBookingBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.customerId !== 'string' || b.customerId.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "customerId" is required and must be a non-empty string' };
  }
  if (!isValidUuid(b.customerId)) {
    return { code: 'BAD_REQUEST', message: 'Field "customerId" must be a valid UUID' };
  }
  if (typeof b.flightId !== 'string' || b.flightId.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "flightId" is required and must be a non-empty string' };
  }
  if (!isValidUuid(b.flightId)) {
    return { code: 'BAD_REQUEST', message: 'Field "flightId" must be a valid UUID' };
  }
  if (typeof b.bookingTimestamp !== 'string') {
    return { code: 'BAD_REQUEST', message: 'Field "bookingTimestamp" is required and must be an ISO 8601 datetime string' };
  }
  if (isNaN(Date.parse(b.bookingTimestamp))) {
    return { code: 'BAD_REQUEST', message: 'Field "bookingTimestamp" must be a valid ISO 8601 datetime' };
  }
  if (b.seatsBooked !== undefined) {
    // `seats_booked` is Prisma `Int`, which maps to a Postgres 32-bit
    // `integer` (max 2147483647). Values above that are still JS integers, so
    // they must be rejected here to satisfy the positive-integer contract
    // instead of reaching the data layer and failing as a 500
    // (data-integrity.md: invalid input MUST NOT produce a 500).
    if (
      typeof b.seatsBooked !== 'number' ||
      !Number.isInteger(b.seatsBooked) ||
      b.seatsBooked <= 0 ||
      b.seatsBooked > MAX_SEATS_BOOKED
    ) {
      return { code: 'BAD_REQUEST', message: 'Field "seatsBooked" must be a positive integer' };
    }
  }
  return null;
}