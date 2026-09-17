import type { PrismaClient } from '../../src/generated/prisma/client';
import { resetDatabase, testDatabaseUrl } from '../helpers/testDb';
import { prismaClientFor } from '../../src/shared/prismaClient';
import {
  runSeed,
  EXPECTED_COUNTS,
  AIRLINES,
  CUSTOMERS,
  FLIGHTS,
  BOOKINGS,
} from '../../prisma/seed/seed';

const DB_URL = testDatabaseUrl();

beforeEach(async () => {
  await resetDatabase(DB_URL);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Idempotent resource seeding', () => {
  it('creates the expected number of records on the first run', async () => {
    const result = await runSeed(DB_URL);
    expect(result.created).toEqual(EXPECTED_COUNTS);
    expect(result.totals).toEqual(EXPECTED_COUNTS);
  });

  it('produces zero additional records on a second run', async () => {
    const first = await runSeed(DB_URL);
    const second = await runSeed(DB_URL);
    expect(second.created).toEqual({ airlines: 0, customers: 0, flights: 0, bookings: 0 });
    expect(second.totals).toEqual(first.totals);
  });

  it('assigns a generated UUID distinct from the natural key to every record', async () => {
    await runSeed(DB_URL);
    const client: PrismaClient = prismaClientFor(DB_URL);

    const airlines = await client.airline.findMany({ select: { id: true, code: true } });
    expect(airlines.length).toBe(AIRLINES.length);
    for (const row of airlines) {
      expect(row.id).toMatch(UUID_RE);
      expect(row.id).not.toBe(row.code);
    }

    const customers = await client.customer.findMany({ select: { id: true, email: true } });
    expect(customers.length).toBe(CUSTOMERS.length);
    for (const row of customers) {
      expect(row.id).toMatch(UUID_RE);
      expect(row.id).not.toBe(row.email);
    }

    const flights = await client.flight.findMany({ select: { id: true, flight_number: true } });
    expect(flights.length).toBe(FLIGHTS.length);
    for (const row of flights) {
      expect(row.id).toMatch(UUID_RE);
      expect(row.id).not.toBe(row.flight_number);
    }

    const bookings = await client.booking.findMany({ select: { id: true } });
    expect(bookings.length).toBe(BOOKINGS.length);
    for (const row of bookings) {
      expect(row.id).toMatch(UUID_RE);
    }
  });

  it('every seeded flight references a valid, already-seeded airline', async () => {
    await runSeed(DB_URL);
    const client: PrismaClient = prismaClientFor(DB_URL);

    const airlineIds = new Set(
      (await client.airline.findMany({ select: { id: true } })).map((a) => a.id),
    );
    expect(airlineIds.size).toBe(AIRLINES.length);

    const flights = await client.flight.findMany({ select: { airline_id: true } });
    expect(flights.length).toBe(FLIGHTS.length);
    for (const row of flights) {
      expect(airlineIds.has(row.airline_id)).toBe(true);
    }
  });

  it('every seeded booking references a valid customer and flight', async () => {
    await runSeed(DB_URL);
    const client: PrismaClient = prismaClientFor(DB_URL);

    const customerIds = new Set(
      (await client.customer.findMany({ select: { id: true } })).map((c) => c.id),
    );
    const flightIds = new Set(
      (await client.flight.findMany({ select: { id: true } })).map((f) => f.id),
    );

    expect(customerIds.size).toBe(CUSTOMERS.length);
    expect(flightIds.size).toBe(FLIGHTS.length);

    const bookings = await client.booking.findMany({ select: { customer_id: true, flight_id: true } });
    expect(bookings.length).toBe(BOOKINGS.length);
    for (const row of bookings) {
      expect(customerIds.has(row.customer_id)).toBe(true);
      expect(flightIds.has(row.flight_id)).toBe(true);
    }
  });
});
