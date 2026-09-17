import type { FilterFieldDef, SortableFieldDef } from '../../shared/query';
import { isValidUuid } from '../../shared/validation';

export type ValidationError = { code: string; message: string } | null;

// Allowed list-endpoint filter and sort parameters (list-endpoint-pagination-
// filter-sort skill). Values are camelCase API names; columns are snake_case.
// PRD §3: flights filter by origin and destination, with date as a third filter
// (matched against the departure date).
export const FLIGHT_FILTER_FIELDS: FilterFieldDef[] = [
  { field: 'origin', mode: 'exact' },
  { field: 'destination', mode: 'exact' },
  { field: 'date', mode: 'date' },
];

export const FLIGHT_SORTABLE_FIELDS: SortableFieldDef[] = [
  { field: 'flightNumber' },
  { field: 'origin' },
  { field: 'destination' },
  { field: 'departureTime' },
  { field: 'arrivalTime' },
  { field: 'price' },
  { field: 'id' },
];

export function validateFlightBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.airlineId !== 'string' || b.airlineId.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "airlineId" is required and must be a non-empty string' };
  }
  if (!isValidUuid(b.airlineId)) {
    return { code: 'BAD_REQUEST', message: 'Field "airlineId" must be a valid UUID' };
  }
  if (typeof b.flightNumber !== 'string' || b.flightNumber.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "flightNumber" is required and must be a non-empty string' };
  }
  if (typeof b.origin !== 'string' || b.origin.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "origin" is required and must be a non-empty string' };
  }
  if (typeof b.destination !== 'string' || b.destination.trim() === '') {
    return { code: 'BAD_REQUEST', message: 'Field "destination" is required and must be a non-empty string' };
  }
  if (typeof b.departureTime !== 'string') {
    return { code: 'BAD_REQUEST', message: 'Field "departureTime" is required and must be an ISO 8601 datetime string' };
  }
  if (isNaN(Date.parse(b.departureTime))) {
    return { code: 'BAD_REQUEST', message: 'Field "departureTime" must be a valid ISO 8601 datetime' };
  }
  if (typeof b.arrivalTime !== 'string') {
    return { code: 'BAD_REQUEST', message: 'Field "arrivalTime" is required and must be an ISO 8601 datetime string' };
  }
  if (isNaN(Date.parse(b.arrivalTime))) {
    return { code: 'BAD_REQUEST', message: 'Field "arrivalTime" must be a valid ISO 8601 datetime' };
  }
  if (typeof b.price !== 'number' || !Number.isFinite(b.price) || b.price <= 0) {
    return { code: 'BAD_REQUEST', message: 'Field "price" is required and must be a finite positive number' };
  }
  if (typeof b.seatCapacity !== 'number' || !Number.isInteger(b.seatCapacity) || b.seatCapacity <= 0) {
    return { code: 'BAD_REQUEST', message: 'Field "seatCapacity" is required and must be a positive integer' };
  }
  return null;
}

export function validateFlightUpdateBody(body: unknown): ValidationError {
  if (!body || typeof body !== 'object') {
    return { code: 'BAD_REQUEST', message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const allowed = ['airlineId', 'flightNumber', 'origin', 'destination', 'departureTime', 'arrivalTime', 'price', 'seatCapacity'];
  const keys = Object.keys(b);
  if (keys.length === 0) {
    return { code: 'BAD_REQUEST', message: 'At least one field must be provided for update' };
  }
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return { code: 'BAD_REQUEST', message: `Unexpected field "${key}"` };
    }
  }
  if (b.airlineId !== undefined && (typeof b.airlineId !== 'string' || !isValidUuid(b.airlineId))) {
    return { code: 'BAD_REQUEST', message: 'Field "airlineId" must be a valid UUID' };
  }
  if (b.flightNumber !== undefined && (typeof b.flightNumber !== 'string' || b.flightNumber.trim() === '')) {
    return { code: 'BAD_REQUEST', message: 'Field "flightNumber" must be a non-empty string' };
  }
  if (b.origin !== undefined && (typeof b.origin !== 'string' || b.origin.trim() === '')) {
    return { code: 'BAD_REQUEST', message: 'Field "origin" must be a non-empty string' };
  }
  if (b.destination !== undefined && (typeof b.destination !== 'string' || b.destination.trim() === '')) {
    return { code: 'BAD_REQUEST', message: 'Field "destination" must be a non-empty string' };
  }
  if (b.departureTime !== undefined && (typeof b.departureTime !== 'string' || isNaN(Date.parse(b.departureTime)))) {
    return { code: 'BAD_REQUEST', message: 'Field "departureTime" must be a valid ISO 8601 datetime' };
  }
  if (b.arrivalTime !== undefined && (typeof b.arrivalTime !== 'string' || isNaN(Date.parse(b.arrivalTime)))) {
    return { code: 'BAD_REQUEST', message: 'Field "arrivalTime" must be a valid ISO 8601 datetime' };
  }
  if (b.price !== undefined && (typeof b.price !== 'number' || !Number.isFinite(b.price) || b.price <= 0)) {
    return { code: 'BAD_REQUEST', message: 'Field "price" must be a finite positive number' };
  }
  if (b.seatCapacity !== undefined && (typeof b.seatCapacity !== 'number' || !Number.isInteger(b.seatCapacity) || b.seatCapacity <= 0)) {
    return { code: 'BAD_REQUEST', message: 'Field "seatCapacity" must be a positive integer' };
  }
  return null;
}