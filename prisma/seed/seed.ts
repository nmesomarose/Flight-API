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

// ── Seed data (base sample + deterministic expansion) ───────────────────

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

const BASE_AIRLINES: AirlineSeed[] = [
  { name: 'Skyline Airways', code: 'SL', country: 'United Kingdom' },
  { name: 'Alpine Air', code: 'AA', country: 'Switzerland' },
  { name: 'Pacific Wings', code: 'PW', country: 'United States' },
];

const BASE_CUSTOMERS: CustomerSeed[] = [
  { fullName: 'Ada Lovelace', email: 'ada.lovelace@example.com' },
  { fullName: 'Grace Hopper', email: 'grace.hopper@example.com' },
  { fullName: 'Alan Turing', email: 'alan.turing@example.com' },
  { fullName: 'Katherine Johnson', email: 'katherine.johnson@example.com' },
];

const BASE_FLIGHTS: FlightSeed[] = [
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

const BASE_BOOKINGS: BookingSeed[] = [
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

// ── Deterministic expansion to few-hundred scale ─────────────────────────
// The small base dataset above is expanded to a few-hundred-record dataset
// (300 airlines / 400 customers / 500 flights / 600 bookings) using pure,
// index-driven generators so the full dataset is identical on every run.
// Generated records reuse the same stable natural keys as the base dataset,
// so the existing dedupe logic keeps re-runs idempotent. References are
// arranged so every generated Flight points at a valid Airline and every
// generated Booking points at a valid Customer and Flight.

const TARGET_AIRLINES = 300;
const TARGET_CUSTOMERS = 400;
const TARGET_FLIGHTS = 500;
const TARGET_BOOKINGS = 600;

const AIRLINE_NAME_PREFIXES = [
  'Skyline', 'Alpine', 'Pacific', 'Atlantic', 'Nordic', 'Meridian', 'Aurora', 'Solar',
  'Stellar', 'Voyager', 'Cascadian', 'Andean', 'Celtic', 'Sahara', 'Tropic', 'Arctic',
  'Azure', 'Crimson', 'Golden', 'Silver', 'Emerald', 'Crystal', 'Horizon', 'Summit',
  'Ridge', 'Coastal', 'Harbour', 'Zenith', 'Comet', 'Nova', 'Orion', 'Vega',
  'Eagle', 'Falcon', 'Swift', 'Velocity', 'Halcyon', 'Pioneer', 'Beacon', 'Equinox',
];

const AIRLINE_NAME_SUFFIXES = ['Air', 'Airways', 'Airlines', 'Aviation', 'Wings', 'Aero', 'Jet', 'Express'];

const COUNTRIES = [
  'United Kingdom', 'Switzerland', 'United States', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands',
  'Portugal', 'Ireland', 'Belgium', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Poland', 'Czechia', 'Greece', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia',
  'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Iceland', 'Japan', 'South Korea', 'Singapore',
  'Australia', 'New Zealand', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'South Africa', 'India',
];

const FIRST_NAMES = [
  'Ada', 'Grace', 'Alan', 'Katherine', 'Margaret', 'Barbara', 'Sara', 'Marta',
  'Peggy', 'Cynthia', 'Whitney', 'Annie', 'Mary', 'Joan', 'Hedy', 'Radia',
  'Frances', 'Karen', 'Shafrira', 'Rosalind',
];

const LAST_NAMES = [
  'Lovelace', 'Hopper', 'Turing', 'Johnson', 'Hamilton', 'Liskov', 'Nelson', 'Crawford',
  'Frank', 'Wintle', 'Houston', 'Easley', 'Wilkes', 'Clarke', 'Lamarr', 'Perlman',
  'Allen', 'Sparck', 'Goldwasser', 'Rossum',
];

const AIRPORTS = [
  'London Heathrow', 'Paris CDG', 'Madrid Barajas', 'Rome Fiumicino', 'Zurich', 'Vienna',
  'Munich', 'Frankfurt', 'Amsterdam', 'Dublin', 'Berlin', 'Copenhagen',
  'Stockholm', 'Oslo', 'Helsinki', 'Lisbon', 'Barcelona', 'Milan Malpensa',
  'Brussels', 'Warsaw', 'Prague', 'Athens', 'Budapest', 'Bucharest',
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '.');
}

function twoLetterCodes(count: number, exclude: ReadonlySet<string>): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 26 * 26 && codes.length < count; i += 1) {
    const code = String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!exclude.has(code)) codes.push(code);
  }
  return codes;
}

function flightDepartureTime(f: number): Date {
  return new Date(Date.UTC(2026, 9, 1 + (f % 40), 5 + (f % 14), (f * 13) % 60, 0));
}

function flightArrivalTime(departure: Date, f: number): Date {
  return new Date(departure.getTime() + (90 + (f % 6) * 30) * 60_000);
}

const GENERATED_AIRLINES: AirlineSeed[] = twoLetterCodes(
  TARGET_AIRLINES - BASE_AIRLINES.length,
  new Set(BASE_AIRLINES.map((a) => a.code)),
).map((code, i) => {
  const idx = BASE_AIRLINES.length + i;
  return {
    name: `${AIRLINE_NAME_PREFIXES[idx % AIRLINE_NAME_PREFIXES.length]} ${
      AIRLINE_NAME_SUFFIXES[Math.floor(idx / AIRLINE_NAME_PREFIXES.length) % AIRLINE_NAME_SUFFIXES.length]
    }`,
    code,
    country: COUNTRIES[idx % COUNTRIES.length],
  };
});

export const AIRLINES: AirlineSeed[] = [...BASE_AIRLINES, ...GENERATED_AIRLINES];

const BASE_CUSTOMER_EMAILS = new Set(BASE_CUSTOMERS.map((c) => c.email));
const GENERATED_CUSTOMERS: CustomerSeed[] = [];
{
  let n = 0;
  for (
    let grid = 0;
    grid < FIRST_NAMES.length * LAST_NAMES.length &&
    GENERATED_CUSTOMERS.length < TARGET_CUSTOMERS - BASE_CUSTOMERS.length;
    grid += 1
  ) {
    const first = FIRST_NAMES[grid % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(grid / FIRST_NAMES.length) % LAST_NAMES.length];
    const fullName = `${first} ${last}`;
    const email = `${slugify(first)}.${slugify(last)}@example.com`;
    if (BASE_CUSTOMER_EMAILS.has(email)) continue;
    GENERATED_CUSTOMERS.push({
      fullName,
      email,
      ...(n % 2 === 0 ? { phoneNumber: `+1-555-${String(2000 + n)}` } : {}),
    });
    n += 1;
  }
}

export const CUSTOMERS: CustomerSeed[] = [...BASE_CUSTOMERS, ...GENERATED_CUSTOMERS];

const GENERATED_FLIGHTS: FlightSeed[] = Array.from(
  { length: TARGET_FLIGHTS - BASE_FLIGHTS.length },
  (_, i) => {
    const f = i;
    const code = AIRLINES[f % AIRLINES.length].code;
    const departureTime = flightDepartureTime(f);
    return {
      flightNumber: `${code}${100 + Math.floor(f / 300)}`,
      airlineCode: code,
      origin: AIRPORTS[f % AIRPORTS.length],
      destination: AIRPORTS[(f + 11) % AIRPORTS.length],
      departureTime: departureTime.toISOString(),
      arrivalTime: flightArrivalTime(departureTime, f).toISOString(),
      price: 50 + ((f * 37) % 851),
      seatCapacity: 120 + (f % 11) * 20,
    };
  },
);

export const FLIGHTS: FlightSeed[] = [...BASE_FLIGHTS, ...GENERATED_FLIGHTS];

const GENERATED_BOOKINGS: BookingSeed[] = Array.from(
  { length: TARGET_BOOKINGS - BASE_BOOKINGS.length },
  (_, i) => {
    const b = i;
    const customer = CUSTOMERS[4 + (b % 396)];
    const flight = FLIGHTS[8 + (b % 492)];
    return {
      customerEmail: customer.email,
      flightNumber: flight.flightNumber,
      flightDepartureTime: flight.departureTime,
      bookingTimestamp: new Date(Date.UTC(2026, 8, 1 + (b % 30), 8 + (b % 10), (b * 7) % 60, 0)).toISOString(),
      seatsBooked: 1 + (b % 4),
    };
  },
);

export const BOOKINGS: BookingSeed[] = [...BASE_BOOKINGS, ...GENERATED_BOOKINGS];

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
