import type { Prisma, PrismaClient, Airline, Flight } from '../../generated/prisma/client';
import type { ListParams } from '../../shared/query';
import { buildFlightWhere, buildFlightOrderBy, findFlightsWith } from '../flights/flights.data';

function buildAirlineWhere(params: ListParams): Prisma.AirlineWhereInput {
  const AND: Prisma.AirlineWhereInput[] = [];
  for (const f of params.filters) {
    switch (f.field) {
      case 'name':
        AND.push({ name: { contains: f.value, mode: 'insensitive' } });
        break;
      case 'code':
        AND.push({ code: f.value });
        break;
      case 'country':
        AND.push({ country: f.value });
        break;
      default:
        break;
    }
  }
  return AND.length > 0 ? { AND } : {};
}

// Default order is name ascending; an explicit sort uses that field plus an
// `id` tiebreak so offset pagination is deterministic.
function buildAirlineOrderBy(params: ListParams): Prisma.AirlineOrderByWithRelationInput[] {
  const orderBy: Prisma.AirlineOrderByWithRelationInput[] = [];
  if (params.sort === null) {
    orderBy.push({ name: 'asc' });
  } else {
    const dir = params.sort.direction;
    switch (params.sort.field) {
      case 'name':
        orderBy.push({ name: dir });
        break;
      case 'code':
        orderBy.push({ code: dir });
        break;
      case 'country':
        orderBy.push({ country: dir });
        break;
      default:
        orderBy.push({ id: dir });
        break;
    }
    if (params.sort.field !== 'id') orderBy.push({ id: 'asc' });
  }
  return orderBy;
}

export async function findAllAirlines(
  client: PrismaClient,
  params: ListParams,
): Promise<{ rows: Airline[]; total: number }> {
  const where = buildAirlineWhere(params);
  const [rows, total] = await Promise.all([
    client.airline.findMany({ where, orderBy: buildAirlineOrderBy(params), skip: params.offset, take: params.limit }),
    client.airline.count({ where }),
  ]);
  return { rows, total };
}

export async function findAirlineById(client: PrismaClient, id: string): Promise<Airline | null> {
  return client.airline.findUnique({ where: { id } });
}

export async function createAirline(
  client: PrismaClient,
  data: { id: string; name: string; code: string; country: string }
): Promise<Airline> {
  return client.airline.create({ data });
}

export async function updateAirline(
  client: PrismaClient,
  id: string,
  data: { name?: string; code?: string; country?: string }
): Promise<Airline | null> {
  try {
    return await client.airline.update({ where: { id }, data });
  } catch {
    return null;
  }
}

export async function deleteAirline(client: PrismaClient, id: string): Promise<boolean> {
  try {
    await client.airline.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function countFlightsForAirline(client: PrismaClient, airlineId: string): Promise<number> {
  return client.flight.count({ where: { airline_id: airlineId } });
}

export async function findFlightsByAirline(
  client: PrismaClient,
  airlineId: string,
  params: ListParams,
): Promise<{ rows: Flight[]; total: number }> {
  const where = buildFlightWhere(params, { airline_id: airlineId });
  return findFlightsWith(client, where, buildFlightOrderBy(params), params);
}