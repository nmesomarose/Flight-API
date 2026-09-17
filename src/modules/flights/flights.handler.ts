import type { Request, Response, NextFunction } from 'express';
import type { Flight } from '../../generated/prisma/client';
import { successEnvelope, errorEnvelope } from '../../shared/envelope';
import { prismaClientFor } from '../../shared/prismaClient';
import { parseListQuery } from '../../shared/query';
import {
  validateFlightBody,
  validateFlightUpdateBody,
  FLIGHT_FILTER_FIELDS,
  FLIGHT_SORTABLE_FIELDS,
} from './flights.validation';
import { BOOKING_FILTER_FIELDS, BOOKING_SORTABLE_FIELDS } from '../bookings/bookings.validation';
import { isValidUuid, toIdParam } from '../../shared/validation';
import { toBookingResponse } from '../bookings/bookings.handler';
import * as data from './flights.data';

function dbUrl(req: Request): string {
  return req.app.locals.databaseUrl as string;
}

// Maps a raw Prisma flight record to camelCase for the API response.
// Prisma returns `price` as a Decimal; convert to number for JSON.
export function toFlightResponse(flight: Flight) {
  return {
    id: flight.id,
    airlineId: flight.airline_id,
    flightNumber: flight.flight_number,
    origin: flight.origin,
    destination: flight.destination,
    departureTime: flight.departure_time,
    arrivalTime: flight.arrival_time,
    price: Number(flight.price),
    seatCapacity: flight.seat_capacity,
  };
}

// ── List ──────────────────────────────────────────────────────────────
export async function listFlights(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseListQuery(
      req.query as Record<string, unknown>,
      FLIGHT_FILTER_FIELDS,
      FLIGHT_SORTABLE_FIELDS,
    );
    if (!parsed.ok) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', parsed.error));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const { rows, total } = await data.findAllFlights(client, parsed.params);
    res.json(
      successEnvelope(rows.map(toFlightResponse), {
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
export async function createFlight(req: Request, res: Response, next: NextFunction) {
  try {
    const validationError = validateFlightBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const b = req.body as {
      airlineId: string;
      flightNumber: string;
      origin: string;
      destination: string;
      departureTime: string;
      arrivalTime: string;
      price: number;
      seatCapacity: number;
    };

    const client = prismaClientFor(dbUrl(req));

    // Referential integrity guard: airline must exist (404 if not)
    const airline = await data.findAirlineById(client, b.airlineId);
    if (!airline) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
      return;
    }

    const id = crypto.randomUUID();
    const flight = await data.createFlight(client, {
      id,
      airlineId: b.airlineId,
      flightNumber: b.flightNumber,
      origin: b.origin,
      destination: b.destination,
      departureTime: new Date(b.departureTime),
      arrivalTime: new Date(b.arrivalTime),
      price: b.price,
      seatCapacity: b.seatCapacity,
    });
    res.status(201).json(successEnvelope(toFlightResponse(flight)));
  } catch (err) {
    next(err);
  }
}

// ── Get by ID ─────────────────────────────────────────────────────────
export async function getFlight(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Flight ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const flight = await data.findFlightById(client, id);
    if (!flight) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Flight not found'));
      return;
    }
    res.json(successEnvelope(toFlightResponse(flight)));
  } catch (err) {
    next(err);
  }
}

// ── Update ────────────────────────────────────────────────────────────
export async function updateFlight(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Flight ID must be a valid UUID'));
      return;
    }

    const validationError = validateFlightUpdateBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findFlightById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Flight not found'));
      return;
    }

    const b = req.body as Record<string, unknown>;

    // If airlineId is being changed, validate the new airline exists
    if (b.airlineId !== undefined) {
      const airline = await data.findAirlineById(client, b.airlineId as string);
      if (!airline) {
        res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
        return;
      }
    }

    const updated = await data.updateFlight(client, id, {
      airlineId: b.airlineId as string | undefined,
      flightNumber: b.flightNumber as string | undefined,
      origin: b.origin as string | undefined,
      destination: b.destination as string | undefined,
      departureTime: b.departureTime !== undefined ? new Date(b.departureTime as string) : undefined,
      arrivalTime: b.arrivalTime !== undefined ? new Date(b.arrivalTime as string) : undefined,
      price: b.price as number | undefined,
      seatCapacity: b.seatCapacity as number | undefined,
    });
    if (!updated) {
      res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'Failed to update flight'));
      return;
    }
    res.json(successEnvelope(toFlightResponse(updated)));
  } catch (err) {
    next(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteFlight(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Flight ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findFlightById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Flight not found'));
      return;
    }

    const dependentCount = await data.countBookingsForFlight(client, id);
    if (dependentCount > 0) {
      res.status(409).json(errorEnvelope('CONFLICT', 'Cannot delete flight: dependent bookings exist'));
      return;
    }

    await data.deleteFlight(client, id);
    res.status(200).json(successEnvelope(null));
  } catch (err) {
    next(err);
  }
}

// ── List bookings for a flight ────────────────────────────────────────
export async function listFlightBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Flight ID must be a valid UUID'));
      return;
    }

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
    const flight = await data.findFlightById(client, id);
    if (!flight) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Flight not found'));
      return;
    }

    const { rows, total } = await data.findBookingsByFlight(client, id, parsed.params);
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