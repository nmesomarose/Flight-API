import type { Request, Response, NextFunction } from 'express';
import { successEnvelope, errorEnvelope } from '../../shared/envelope';
import { prismaClientFor } from '../../shared/prismaClient';
import { parseListQuery } from '../../shared/query';
import {
  validateAirlineBody,
  validateAirlineUpdateBody,
  AIRLINE_FILTER_FIELDS,
  AIRLINE_SORTABLE_FIELDS,
} from './airlines.validation';
import { FLIGHT_FILTER_FIELDS, FLIGHT_SORTABLE_FIELDS } from '../flights/flights.validation';
import { isValidUuid, toIdParam } from '../../shared/validation';
import { toFlightResponse } from '../flights/flights.handler';
import * as data from './airlines.data';

function dbUrl(req: Request): string {
  return req.app.locals.databaseUrl as string;
}

// ── List ──────────────────────────────────────────────────────────────
export async function listAirlines(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseListQuery(
      req.query as Record<string, unknown>,
      AIRLINE_FILTER_FIELDS,
      AIRLINE_SORTABLE_FIELDS,
    );
    if (!parsed.ok) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', parsed.error));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const { rows, total } = await data.findAllAirlines(client, parsed.params);
    res.json(
      successEnvelope(rows, {
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
export async function createAirline(req: Request, res: Response, next: NextFunction) {
  try {
    const validationError = validateAirlineBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const { name, code, country } = req.body as { name: string; code: string; country: string };
    const client = prismaClientFor(dbUrl(req));
    const id = crypto.randomUUID();
    const airline = await data.createAirline(client, { id, name, code, country });
    res.status(201).json(successEnvelope(airline));
  } catch (err) {
    next(err);
  }
}

// ── Get by ID ─────────────────────────────────────────────────────────
export async function getAirline(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Airline ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const airline = await data.findAirlineById(client, id);
    if (!airline) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
      return;
    }
    res.json(successEnvelope(airline));
  } catch (err) {
    next(err);
  }
}

// ── Update ────────────────────────────────────────────────────────────
export async function updateAirline(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Airline ID must be a valid UUID'));
      return;
    }

    const validationError = validateAirlineUpdateBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findAirlineById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
      return;
    }

    const { name, code, country } = req.body as { name?: string; code?: string; country?: string };
    const airline = await data.updateAirline(client, id, { name, code, country });
    if (!airline) {
      res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'Failed to update airline'));
      return;
    }
    res.json(successEnvelope(airline));
  } catch (err) {
    next(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteAirline(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Airline ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findAirlineById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
      return;
    }

    const dependentCount = await data.countFlightsForAirline(client, id);
    if (dependentCount > 0) {
      res.status(409).json(errorEnvelope('CONFLICT', 'Cannot delete airline: dependent flights exist'));
      return;
    }

    await data.deleteAirline(client, id);
    res.status(200).json(successEnvelope(null));
  } catch (err) {
    next(err);
  }
}

// ── List flights for an airline ───────────────────────────────────────
export async function listAirlineFlights(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Airline ID must be a valid UUID'));
      return;
    }

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
    const airline = await data.findAirlineById(client, id);
    if (!airline) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Airline not found'));
      return;
    }

    const { rows, total } = await data.findFlightsByAirline(client, id, parsed.params);
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