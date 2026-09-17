import type { Request, Response, NextFunction } from 'express';
import type { Booking } from '../../generated/prisma/client';
import { successEnvelope, errorEnvelope } from '../../shared/envelope';
import { prismaClientFor } from '../../shared/prismaClient';
import { parseListQuery } from '../../shared/query';
import {
  validateBookingBody,
  BOOKING_FILTER_FIELDS,
  BOOKING_SORTABLE_FIELDS,
} from './bookings.validation';
import { isValidUuid, toIdParam } from '../../shared/validation';
import * as data from './bookings.data';

function dbUrl(req: Request): string {
  return req.app.locals.databaseUrl as string;
}

// Maps a raw Prisma booking record to camelCase for the API response.
export function toBookingResponse(booking: Booking) {
  return {
    id: booking.id,
    customerId: booking.customer_id,
    flightId: booking.flight_id,
    bookingTimestamp: booking.booking_timestamp,
    seatsBooked: booking.seats_booked,
  };
}

// ── List ──────────────────────────────────────────────────────────────
export async function listBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseListQuery(
      req.query as Record<string, unknown>,
      BOOKING_FILTER_FIELDS,
      BOOKING_SORTABLE_FIELDS,
    );
    if (!parsed.ok) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', parsed.error));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const { rows, total } = await data.findAllBookings(client, parsed.params);
    res.json(
      successEnvelope(rows.map(toBookingResponse), {
        limit: parsed.params.limit,
        offset: parsed.params.offset,
        total,
        hasMore: parsed.params.offset + rows.length < total,
      }),
    );
  } catch (err) {
    next(err);
  }
}

// ── Create ────────────────────────────────────────────────────────────
export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const validationError = validateBookingBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const b = req.body as {
      customerId: string;
      flightId: string;
      bookingTimestamp: string;
      seatsBooked?: number;
    };

    const client = prismaClientFor(dbUrl(req));

    // Referential integrity guard: both customer and flight must exist (404 if not)
    const customer = await data.findCustomerById(client, b.customerId);
    if (!customer) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Customer not found'));
      return;
    }
    const flight = await data.findFlightById(client, b.flightId);
    if (!flight) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Flight not found'));
      return;
    }

    const id = crypto.randomUUID();
    const booking = await data.createBooking(client, {
      id,
      customerId: b.customerId,
      flightId: b.flightId,
      bookingTimestamp: new Date(b.bookingTimestamp),
      seatsBooked: b.seatsBooked ?? 1,
    });
    res.status(201).json(successEnvelope(toBookingResponse(booking)));
  } catch (err) {
    next(err);
  }
}

// ── Get by ID ─────────────────────────────────────────────────────────
export async function getBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Booking ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const booking = await data.findBookingById(client, id);
    if (!booking) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Booking not found'));
      return;
    }
    res.json(successEnvelope(toBookingResponse(booking)));
  } catch (err) {
    next(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────
// Booking deletion is always allowed and represents cancellation.
// No dependent-record check is needed (booking-specific.md).
export async function deleteBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Booking ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findBookingById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Booking not found'));
      return;
    }

    await data.deleteBooking(client, id);
    res.status(200).json(successEnvelope(null));
  } catch (err) {
    next(err);
  }
}