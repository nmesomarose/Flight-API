// Seed script for the Flight Booking REST API.
//
// Contract (data-integrity.md, idempotent-resource-seeding skill):
//   - Seeding MUST be idempotent: re-running produces zero new records.
//   - Insert order: Airlines → Customers → Flights → Bookings (FK graph).
//   - Dedupe via stable natural keys:
//       Airline   → code
//       Customer  → email
//       Flight    → flightNumber + departureTime (ISO-8601 UTC)
//       Booking   → customerEmail + Flight's natural key
//   - Every record gets a generated UUID (crypto.randomUUID), never the
//     natural key used for dedup.

import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '../../src/db';
import type { PrismaClient } from '../../src/generated/prisma/client';

// ── Sample data ─────────────────────────────────────────────────────────

interface AirlineSeed {
  name: string;
  code: string;
  country: string;
}

interface CustomerSeed {
  fullName: string;
  email: string;
  phoneNumber?: string;
}

interface FlightSeed {
  flightNumber: string;
  airlineCode: string;
  origin: string;
  destination: string;
  departureTime: string; // ISO-8601 UTC
  arrivalTime: string;
  price: number;
  seatCapacity: number;
}

interface BookingSeed {
  customerEmail: string;
  flightNumber: string;
  flightDepartureTime: string; // must match a FlightSeed's departureTime
  bookingTimestamp: string;    // ISO-8601 UTC
  seatsBooked?: number;
}

export const AIRLINES: AirlineSeed[] = [
  { name: 'Skyline Airways', code: 'SL', country: 'United Kingdom' },
  { name: 'Alpine Air', code: 'AA', country: 'Switzerland' },
  { name: 'Pacific Wings', code: 'PW', country: 'United States' },
];

export const CUSTOMERS: CustomerSeed[] = [
  { fullName: 'Ada Lovelace', email: 'ada.lovelace@example.com' },
  { fullName: 'Grace Hopper', email: 'grace.hopper@example.com' },
  { fullName: 'Alan Turing', email: 'alan.turing@example.com' },
  { fullName: 'Katherine Johnson', email: 'katherine.johnson@example.com' },
];

export const FLIGHTS: FlightSeed[] = [
  // Skyline Airways (SL)
  { flightNumber: 'SL101', airlineCode: 'SL', origin: 'London Heathrow', destination: 'Paris CDG', departureTime: '2026-10-01T08:00:00.000Z', arrivalTime: '2026-10-01T10:30:00.000Z', price: 250, seatCapacity: 180 },
  { flightNumber: 'SL102', airlineCode: 'SL', origin: 'London Heathrow', destination: 'Madrid Barajas', departureTime: '2026-10-02T09:00:00.000Z', arrivalTime: '2026-10-02T12:00:00.000Z', price: 320, seatCapacity: 180 },
  { flightNumber: 'SL103', airlineCode: 'SL', origin: 'London Heathrow', destination: 'Rome Fiumicino', departureTime: '2026-10-03T07:30:00.000Z', arrivalTime: '2026-10-03T11:00:00.000Z', price: 410, seatCapacity: 180 },
  // Alpine Air (AA)
  { flightNumber: 'AA101', airlineCode: 'AA', origin: 'Zurich', destination: 'Vienna', departureTime: '2026-10-01T06:00:00.000Z', arrivalTime: '2026-10-01T07:30:00.000Z', price: 180, seatCapacity: 140 },
  { flightNumber: 'AA102', airlineCode: 'AA', origin: 'Zurich', destination: 'Munich', departureTime: '2026-10-02T07:00:00.000Z', arrivalTime: '2026-10-02T07:45:00.000Z', price: 120, seatCapacity: 140 },
  // Pacific Wings (PW)
  { flightNumber: 'PW101', airlineCode: 'PW', origin: 'Los Angeles', destination: 'San Francisco', departureTime: '2026-10-01T11:00:00.000Z', arrivalTime: '2026-10-01T12:15:00.000Z', price: 95, seatCapacity: 200 },
  { flightNumber: 'PW102', airlineCode: 'PW', origin: 'Los Angeles', destination: 'New York JFK', departureTime: '2026-10-01T13:00:00.000Z', arrivalTime: '2026-10-01T21:00:00.000Z', price: 450, seatCapacity: 200 },
  { flightNumber: 'PW103', airlineCode: 'PW', origin: 'Los Angeles', destination: 'Seattle', departureTime: '2026-10-02T08:00:00.000Z', arrivalTime: '2026-10-02T10:30:00.000Z', price: 175, seatCapacity: 200 },
];

export const BOOKINGS: BookingSeed[] = [
  // Ada Lovelace
  { customerEmail: 'ada.lovelace@example.com', flightNumber: 'SL101', flightDepartureTime: '2026-10-01T08:00:00.000Z', bookingTimestamp: '2026-09-10T10:00:00.000Z', seatsBooked: 2 },
  { customerEmail: 'ada.lovelace@example.com', flightNumber: 'AA101', flightDepartureTime: '2026-10-01T06:00:00.000Z', bookingTimestamp: '2026-09-11T12:00:00.000Z', seatsBooked: 1 },
  { customerEmail: 'ada.lovelace@example.com', flightNumber: 'PW101', flightDepartureTime: '2026-10-01T11:00:00.000Z', bookingTimestamp: '2026-09-12T09:00:00.000Z', seatsBooked: 3 },
  // Grace Hopper
  { customerEmail: 'grace.hopper@example.com', flightNumber: 'SL101', flightDepartureTime: '2026-10-01T08:00:00.000Z', bookingTimestamp: '2026-09-10T14:00:00.000Z', seatsBooked: 1 },
  { customerEmail: 'grace.hopper@example.com', flightNumber: 'SL102', flightDepartureTime: '2026-10-02T09:00:00.000Z', bookingTimestamp: '2026-09-13T10:00:00.000Z', seatsBooked: 2 },
  { customerEmail: 'grace.hopper@example.com', flightNumber: 'PW102', flightDepartureTime: '2026-10-01T13:00:00.000Z', bookingTimestamp: '2026-09-14T11:00:00.000Z', seatsBooked: 4 },
  // Alan Turing
  { customerEmail: 'alan.turing@example.com', flightNumber: 'SL103', flightDepartureTime: '2026-10-03T07:30:00.000Z', bookingTimestamp: '2026-09-15T08:00:00.000Z', seatsBooked: 1 },
  { customerEmail: 'alan.turing@example.com', flightNumber: 'AA102', flightDepartureTime: '2026-10-02T07:00:00.000Z', bookingTimestamp: '2026-09-15T09:00:00.000Z', seatsBooked: 2 },
  { customerEmail: 'alan.turing@example.com', flightNumber: 'PW103', flightDepartureTime: '2026-10-02T08:00:00.000Z', bookingTimestamp: '2026-09-16T10:00:00.000Z', seatsBooked: 1 },
  // Katherine Johnson
  { customerEmail: 'katherine.johnson@example.com', flightNumber: 'SL102', flightDepartureTime: '2026-10-02T09:00:00.000Z', bookingTimestamp: '2026-09-16T11:00:00.000Z', seatsBooked: 1 },
  { customerEmail: 'katherine.johnson@example.com', flightNumber: 'PW101', flightDepartureTime: '2026-10-01T11:00:00.000Z', bookingTimestamp: '2026-09-17T12:00:00.000Z', seatsBooked: 2 },
  { customerEmail: 'katherine.johnson@example.com', flightNumber: 'PW102', flightDepartureTime: '2026-10-01T13:00:00.000Z', bookingTimestamp: '2026-09-18T13:00:00.000Z', seatsBooked: 1 },
];

// Expected record counts after seeding — asserted by tests.
export const EXPECTED_COUNTS = {
  airlines: AIRLINES.length,
  customers: CUSTOMERS.length,
  flights: FLIGHTS.length,
  bookings: BOOKINGS.length,
} as const;

// ── Natural-key helpers ──────────────────────────────────────────────────

function flightNaturalKey(flightNumber: string, departureTime: string): string {
  return `${flightNumber}|${new Date(departureTime).toISOString()}`;
}

// ── Per-resource seed functions ──────────────────────────────────────────

async function seedAirlines(client: PrismaClient): Promise<number> {
  let created = 0;
  for (const a of AIRLINES) {
    const exists = await client.airline.findFirst({ where: { code: a.code }, select: { id: true } });
    if (!exists) {
      await client.airline.create({ data: { id: randomUUID(), ...a } });
      created += 1;
    }
  }
  return created;
}

async function seedCustomers(client: PrismaClient): Promise<number> {
  let created = 0;
  for (const c of CUSTOMERS) {
    const exists = await client.customer.findFirst({ where: { email: c.email }, select: { id: true } });
    if (!exists) {
      await client.customer.create({
        data: {
          id: randomUUID(),
          full_name: c.fullName,
          email: c.email,
          phone_number: c.phoneNumber ?? null,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function airlineCodeToId(client: PrismaClient): Promise<Map<string, string>> {
  const rows = await client.airline.findMany({ select: { id: true, code: true } });
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function seedFlights(client: PrismaClient): Promise<number> {
  const airlineMap = await airlineCodeToId(client);
  let created = 0;
  for (const f of FLIGHTS) {
    const airlineId = airlineMap.get(f.airlineCode);
    if (!airlineId) {
      throw new Error(`Airline code ${f.airlineCode} not found — seed Airlines before Flights`);
    }
    const exists = await client.flight.findFirst({
      where: { flight_number: f.flightNumber, departure_time: new Date(f.departureTime) },
      select: { id: true },
    });
    if (!exists) {
      await client.flight.create({
        data: {
          id: randomUUID(),
          airline_id: airlineId,
          flight_number: f.flightNumber,
          origin: f.origin,
          destination: f.destination,
          departure_time: new Date(f.departureTime),
          arrival_time: new Date(f.arrivalTime),
          price: f.price,
          seat_capacity: f.seatCapacity,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function seedBookings(client: PrismaClient): Promise<number> {
  const customerRows = await client.customer.findMany({ select: { id: true, email: true } });
  const customerMap = new Map(customerRows.map((r) => [r.email, r.id]));

  const flightRows = await client.flight.findMany({ select: { id: true, flight_number: true, departure_time: true } });
  const flightMap = new Map<string, string>();
  for (const r of flightRows) {
    flightMap.set(flightNaturalKey(r.flight_number, r.departure_time.toISOString()), r.id);
  }

  let created = 0;
  for (const b of BOOKINGS) {
    const customerId = customerMap.get(b.customerEmail);
    if (!customerId) {
      throw new Error(`Customer ${b.customerEmail} not found — seed Customers before Bookings`);
    }
    const fKey = flightNaturalKey(b.flightNumber, b.flightDepartureTime);
    const flightId = flightMap.get(fKey);
    if (!flightId) {
      throw new Error(`Flight ${b.flightNumber} (${b.flightDepartureTime}) not found — seed Flights before Bookings`);
    }
    const exists = await client.booking.findFirst({
      where: { customer_id: customerId, flight_id: flightId },
      select: { id: true },
    });
    if (!exists) {
      await client.booking.create({
        data: {
          id: randomUUID(),
          customer_id: customerId,
          flight_id: flightId,
          booking_timestamp: new Date(b.bookingTimestamp),
          seats_booked: b.seatsBooked ?? 1,
        },
      });
      created += 1;
    }
  }
  return created;
}

// ── Public entry point (called by tests and by the CLI runner) ─────────

export interface SeedResult {
  created: { airlines: number; customers: number; flights: number; bookings: number };
  totals: { airlines: number; customers: number; flights: number; bookings: number };
}

export async function runSeed(databaseUrl: string): Promise<SeedResult> {
  const client = createPrismaClient(databaseUrl);
  try {
    const airlinesCreated = await seedAirlines(client);
    const customersCreated = await seedCustomers(client);
    const flightsCreated = await seedFlights(client);
    const bookingsCreated = await seedBookings(client);

    const [totalAirlines, totalCustomers, totalFlights, totalBookings] = await Promise.all([
      client.airline.count(),
      client.customer.count(),
      client.flight.count(),
      client.booking.count(),
    ]);

    return {
      created: {
        airlines: airlinesCreated,
        customers: customersCreated,
        flights: flightsCreated,
        bookings: bookingsCreated,
      },
      totals: {
        airlines: totalAirlines,
        customers: totalCustomers,
        flights: totalFlights,
        bookings: totalBookings,
      },
    };
  } finally {
    await client.$disconnect();
  }
}

// ── CLI runner (npm run db:seed)────────────────────────────────────────

async function main(): Promise<void> {
  const { resolve } = await import('node:path');
  const { existsSync } = await import('node:fs');

  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Set it in .env or in the environment.');
    process.exitCode = 1;
    return;
  }

  const result = await runSeed(url);
  console.log('Seed complete');
  console.log('Created this run:', result.created);
  console.log('Totals after seed:', result.totals);
}

// Detect direct execution under Node CJS (tsx or node).
// When imported by tests, require.main is the jest entry, not this module.
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
