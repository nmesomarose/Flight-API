import type { Prisma, PrismaClient, Booking } from '../../generated/prisma/client';
import type { ListParams } from '../../shared/query';

// Build the Prisma `where` for a booking list query from validated list params.
// `extra` carries relationship constraints (e.g. the owning customer's ID).
export function buildBookingWhere(
  params: ListParams,
  extra: Prisma.BookingWhereInput = {},
): Prisma.BookingWhereInput {
  const AND: Prisma.BookingWhereInput[] = [];
  for (const f of params.filters) {
    switch (f.field) {
      case 'customerId':
        AND.push({ customer_id: f.value });
        break;
      case 'flightId':
        AND.push({ flight_id: f.value });
        break;
      default:
        break;
    }
  }
  if (Object.keys(extra).length > 0) AND.push(extra);
  return AND.length > 0 ? { AND } : {};
}

// Default order is booking_timestamp descending; an explicit sort uses that
// field plus an `id` tiebreak so offset pagination is deterministic.
export function buildBookingOrderBy(params: ListParams): Prisma.BookingOrderByWithRelationInput[] {
  const orderBy: Prisma.BookingOrderByWithRelationInput[] = [];
  if (params.sort === null) {
    orderBy.push({ booking_timestamp: 'desc' });
  } else {
    const dir = params.sort.direction;
    switch (params.sort.field) {
      case 'customerId':
        orderBy.push({ customer_id: dir });
        break;
      case 'flightId':
        orderBy.push({ flight_id: dir });
        break;
      case 'bookingTimestamp':
        orderBy.push({ booking_timestamp: dir });
        break;
      case 'seatsBooked':
        orderBy.push({ seats_booked: dir });
        break;
      default:
        orderBy.push({ id: dir });
        break;
    }
    if (params.sort.field !== 'id') orderBy.push({ id: 'asc' });
  }
  return orderBy;
}

export async function findBookingsWith(
  client: PrismaClient,
  where: Prisma.BookingWhereInput,
  orderBy: Prisma.BookingOrderByWithRelationInput[],
  params: ListParams,
): Promise<{ rows: Booking[]; total: number }> {
  const [rows, total] = await Promise.all([
    client.booking.findMany({ where, orderBy, skip: params.offset, take: params.limit }),
    client.booking.count({ where }),
  ]);
  return { rows, total };
}

export async function findAllBookings(
  client: PrismaClient,
  params: ListParams,
): Promise<{ rows: Booking[]; total: number }> {
  return findBookingsWith(client, buildBookingWhere(params), buildBookingOrderBy(params), params);
}

export async function findBookingById(client: PrismaClient, id: string): Promise<Booking | null> {
  return client.booking.findUnique({ where: { id } });
}

export async function createBooking(
  client: PrismaClient,
  data: {
    id: string;
    customerId: string;
    flightId: string;
    bookingTimestamp: Date;
    seatsBooked: number;
  }
): Promise<Booking> {
  return client.booking.create({
    data: {
      id: data.id,
      customer_id: data.customerId,
      flight_id: data.flightId,
      booking_timestamp: data.bookingTimestamp,
      seats_booked: data.seatsBooked,
    },
  });
}

export async function deleteBooking(client: PrismaClient, id: string): Promise<boolean> {
  try {
    await client.booking.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function findAirlineById(client: PrismaClient, id: string) {
  return client.airline.findUnique({ where: { id }, select: { id: true } });
}

export async function findFlightById(client: PrismaClient, id: string) {
  return client.flight.findUnique({ where: { id }, select: { id: true } });
}

export async function findCustomerById(client: PrismaClient, id: string) {
  return client.customer.findUnique({ where: { id }, select: { id: true } });
}