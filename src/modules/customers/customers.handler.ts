import type { Request, Response, NextFunction } from 'express';
import type { Customer } from '../../generated/prisma/client';
import { successEnvelope, errorEnvelope } from '../../shared/envelope';
import { prismaClientFor } from '../../shared/prismaClient';
import { parseListQuery } from '../../shared/query';
import {
  validateCustomerBody,
  validateCustomerUpdateBody,
  CUSTOMER_FILTER_FIELDS,
  CUSTOMER_SORTABLE_FIELDS,
} from './customers.validation';
import { BOOKING_FILTER_FIELDS, BOOKING_SORTABLE_FIELDS } from '../bookings/bookings.validation';
import { isValidUuid, toIdParam } from '../../shared/validation';
import { toBookingResponse } from '../bookings/bookings.handler';
import * as data from './customers.data';

function dbUrl(req: Request): string {
  return req.app.locals.databaseUrl as string;
}

// Maps a raw Prisma customer record to camelCase for the API response.
function toCustomerResponse(customer: Customer) {
  return {
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email,
    phoneNumber: customer.phone_number,
  };
}

// ── List ──────────────────────────────────────────────────────────────
export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseListQuery(
      req.query as Record<string, unknown>,
      CUSTOMER_FILTER_FIELDS,
      CUSTOMER_SORTABLE_FIELDS,
    );
    if (!parsed.ok) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', parsed.error));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const { rows, total } = await data.findAllCustomers(client, parsed.params);
    res.json(
      successEnvelope(rows.map(toCustomerResponse), {
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
export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const validationError = validateCustomerBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const { fullName, email, phoneNumber } = req.body as {
      fullName: string;
      email: string;
      phoneNumber?: string;
    };

    const client = prismaClientFor(dbUrl(req));
    const id = crypto.randomUUID();
    const customer = await data.createCustomer(client, { id, fullName, email, phoneNumber });
    res.status(201).json(successEnvelope(toCustomerResponse(customer)));
  } catch (err) {
    next(err);
  }
}

// ── Get by ID ─────────────────────────────────────────────────────────
export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Customer ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const customer = await data.findCustomerById(client, id);
    if (!customer) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Customer not found'));
      return;
    }
    res.json(successEnvelope(toCustomerResponse(customer)));
  } catch (err) {
    next(err);
  }
}

// ── Update ────────────────────────────────────────────────────────────
export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Customer ID must be a valid UUID'));
      return;
    }

    const validationError = validateCustomerUpdateBody(req.body);
    if (validationError) {
      res.status(400).json(errorEnvelope(validationError.code, validationError.message));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findCustomerById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Customer not found'));
      return;
    }

    const { fullName, email, phoneNumber } = req.body as {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
    };
    const customer = await data.updateCustomer(client, id, { fullName, email, phoneNumber });
    if (!customer) {
      res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'Failed to update customer'));
      return;
    }
    res.json(successEnvelope(toCustomerResponse(customer)));
  } catch (err) {
    next(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Customer ID must be a valid UUID'));
      return;
    }

    const client = prismaClientFor(dbUrl(req));
    const existing = await data.findCustomerById(client, id);
    if (!existing) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Customer not found'));
      return;
    }

    const dependentCount = await data.countBookingsForCustomer(client, id);
    if (dependentCount > 0) {
      res.status(409).json(errorEnvelope('CONFLICT', 'Cannot delete customer: dependent bookings exist'));
      return;
    }

    await data.deleteCustomer(client, id);
    res.status(200).json(successEnvelope(null));
  } catch (err) {
    next(err);
  }
}

// ── List bookings for a customer ──────────────────────────────────────
export async function listCustomerBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toIdParam(req.params.id);
    if (!id || !isValidUuid(id)) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Customer ID must be a valid UUID'));
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
    const customer = await data.findCustomerById(client, id);
    if (!customer) {
      res.status(404).json(errorEnvelope('NOT_FOUND', 'Customer not found'));
      return;
    }

    const { rows, total } = await data.findBookingsByCustomer(client, id, parsed.params);
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