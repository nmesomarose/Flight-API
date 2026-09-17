import type { Prisma, PrismaClient, Customer, Booking } from '../../generated/prisma/client';
import type { ListParams } from '../../shared/query';
import {
  buildBookingWhere,
  buildBookingOrderBy,
  findBookingsWith,
} from '../bookings/bookings.data';

function buildCustomerWhere(params: ListParams): Prisma.CustomerWhereInput {
  const AND: Prisma.CustomerWhereInput[] = [];
  for (const f of params.filters) {
    switch (f.field) {
      case 'fullName':
        AND.push({ full_name: { contains: f.value, mode: 'insensitive' } });
        break;
      case 'email':
        AND.push({ email: { contains: f.value, mode: 'insensitive' } });
        break;
      default:
        break;
    }
  }
  return AND.length > 0 ? { AND } : {};
}

// Default order is full_name ascending; an explicit sort uses that field plus
// an `id` tiebreak so offset pagination is deterministic.
function buildCustomerOrderBy(params: ListParams): Prisma.CustomerOrderByWithRelationInput[] {
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [];
  if (params.sort === null) {
    orderBy.push({ full_name: 'asc' });
  } else {
    const dir = params.sort.direction;
    switch (params.sort.field) {
      case 'fullName':
        orderBy.push({ full_name: dir });
        break;
      case 'email':
        orderBy.push({ email: dir });
        break;
      default:
        orderBy.push({ id: dir });
        break;
    }
    if (params.sort.field !== 'id') orderBy.push({ id: 'asc' });
  }
  return orderBy;
}

export async function findAllCustomers(
  client: PrismaClient,
  params: ListParams,
): Promise<{ rows: Customer[]; total: number }> {
  const where = buildCustomerWhere(params);
  const [rows, total] = await Promise.all([
    client.customer.findMany({ where, orderBy: buildCustomerOrderBy(params), skip: params.offset, take: params.limit }),
    client.customer.count({ where }),
  ]);
  return { rows, total };
}

export async function findCustomerById(client: PrismaClient, id: string): Promise<Customer | null> {
  return client.customer.findUnique({ where: { id } });
}

export async function createCustomer(
  client: PrismaClient,
  data: { id: string; fullName: string; email: string; phoneNumber?: string }
): Promise<Customer> {
  return client.customer.create({
    data: {
      id: data.id,
      full_name: data.fullName,
      email: data.email,
      phone_number: data.phoneNumber ?? null,
    },
  });
}

export async function updateCustomer(
  client: PrismaClient,
  id: string,
  data: { fullName?: string; email?: string; phoneNumber?: string }
): Promise<Customer | null> {
  try {
    const mapped: Record<string, unknown> = {};
    if (data.fullName !== undefined) mapped.full_name = data.fullName;
    if (data.email !== undefined) mapped.email = data.email;
    if (data.phoneNumber !== undefined) mapped.phone_number = data.phoneNumber;
    return await client.customer.update({ where: { id }, data: mapped });
  } catch {
    return null;
  }
}

export async function deleteCustomer(client: PrismaClient, id: string): Promise<boolean> {
  try {
    await client.customer.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function countBookingsForCustomer(client: PrismaClient, customerId: string): Promise<number> {
  return client.booking.count({ where: { customer_id: customerId } });
}

export async function findBookingsByCustomer(
  client: PrismaClient,
  customerId: string,
  params: ListParams,
): Promise<{ rows: Booking[]; total: number }> {
  const where = buildBookingWhere(params, { customer_id: customerId });
  return findBookingsWith(client, where, buildBookingOrderBy(params), params);
}