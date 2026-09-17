import type { Prisma, PrismaClient, Flight, Booking } from '../../generated/prisma/client';
import type { ListParams } from '../../shared/query';
import {
  buildBookingWhere,
  buildBookingOrderBy,
  findBookingsWith,
} from '../bookings/bookings.data';

// Build the Prisma `where` for a flight list query from validated list params.
// `extra` carries relationship constraints (e.g. the owning airline's ID).
export function buildFlightWhere(
  params: ListParams,
  extra: Prisma.FlightWhereInput = {},
): Prisma.FlightWhereInput {
  const AND: Prisma.FlightWhereInput[] = [];
  for (const f of params.filters) {
    switch (f.field) {
      case 'origin':
        AND.push({ origin: f.value });
        break;
      case 'destination':
        AND.push({ destination: f.value });
        break;
      case 'date': {
        const start = new Date(`${f.value}T00:00:00.000Z`);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        AND.push({ departure_time: { gte: start, lt: end } });
        break;
      }
      default:
        break;
    }
  }
  if (Object.keys(extra).length > 0) AND.push(extra);
  return AND.length > 0 ? { AND } : {};
}

// Default order is departure_time ascending; an explicit sort uses that field
// plus an `id` tiebreak so offset pagination is deterministic.
export function buildFlightOrderBy(params: ListParams): Prisma.FlightOrderByWithRelationInput[] {
  const orderBy: Prisma.FlightOrderByWithRelationInput[] = [];
  if (params.sort === null) {
    orderBy.push({ departure_time: 'asc' });
  } else {
    const dir = params.sort.direction;
    switch (params.sort.field) {
      case 'flightNumber':
        orderBy.push({ flight_number: dir });
        break;
      case 'origin':
        orderBy.push({ origin: dir });
        break;
      case 'destination':
        orderBy.push({ destination: dir });
        break;
      case 'departureTime':
        orderBy.push({ departure_time: dir });
        break;
      case 'arrivalTime':
        orderBy.push({ arrival_time: dir });
        break;
      case 'price':
        orderBy.push({ price: dir });
        break;
      default:
        orderBy.push({ id: dir });
        break;
    }
    if (params.sort.field !== 'id') orderBy.push({ id: 'asc' });
  }
  return orderBy;
}

export async function findFlightsWith(
  client: PrismaClient,
  where: Prisma.FlightWhereInput,
  orderBy: Prisma.FlightOrderByWithRelationInput[],
  params: ListParams,
): Promise<{ rows: Flight[]; total: number }> {
  const [rows, total] = await Promise.all([
    client.flight.findMany({ where, orderBy, skip: params.offset, take: params.limit }),
    client.flight.count({ where }),
  ]);
  return { rows, total };
}

export async function findAllFlights(
  client: PrismaClient,
  params: ListParams,
): Promise<{ rows: Flight[]; total: number }> {
  return findFlightsWith(client, buildFlightWhere(params), buildFlightOrderBy(params), params);
}

export async function findAirlineById(client: PrismaClient, id: string) {
  return client.airline.findUnique({ where: { id }, select: { id: true } });
}

export async function findFlightById(client: PrismaClient, id: string): Promise<Flight | null> {
  return client.flight.findUnique({ where: { id } });
}

export async function createFlight(
  client: PrismaClient,
  data: {
    id: string;
    airlineId: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: Date;
    arrivalTime: Date;
    price: number;
    seatCapacity: number;
  }
): Promise<Flight> {
  return client.flight.create({
    data: {
      id: data.id,
      airline_id: data.airlineId,
      flight_number: data.flightNumber,
      origin: data.origin,
      destination: data.destination,
      departure_time: data.departureTime,
      arrival_time: data.arrivalTime,
      price: data.price,
      seat_capacity: data.seatCapacity,
    },
  });
}

export async function updateFlight(
  client: PrismaClient,
  id: string,
  data: {
    airlineId?: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    departureTime?: Date;
    arrivalTime?: Date;
    price?: number;
    seatCapacity?: number;
  }
): Promise<Flight | null> {
  try {
    const mapped: Record<string, unknown> = {};
    if (data.airlineId !== undefined) mapped.airline_id = data.airlineId;
    if (data.flightNumber !== undefined) mapped.flight_number = data.flightNumber;
    if (data.origin !== undefined) mapped.origin = data.origin;
    if (data.destination !== undefined) mapped.destination = data.destination;
    if (data.departureTime !== undefined) mapped.departure_time = data.departureTime;
    if (data.arrivalTime !== undefined) mapped.arrival_time = data.arrivalTime;
    if (data.price !== undefined) mapped.price = data.price;
    if (data.seatCapacity !== undefined) mapped.seat_capacity = data.seatCapacity;
    return await client.flight.update({ where: { id }, data: mapped });
  } catch {
    return null;
  }
}

export async function deleteFlight(client: PrismaClient, id: string): Promise<boolean> {
  try {
    await client.flight.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function countBookingsForFlight(client: PrismaClient, flightId: string): Promise<number> {
  return client.booking.count({ where: { flight_id: flightId } });
}

export async function findBookingsByFlight(
  client: PrismaClient,
  flightId: string,
  params: ListParams,
): Promise<{ rows: Booking[]; total: number }> {
  const where = buildBookingWhere(params, { flight_id: flightId });
  return findBookingsWith(client, where, buildBookingOrderBy(params), params);
}