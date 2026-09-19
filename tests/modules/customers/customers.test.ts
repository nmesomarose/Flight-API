import request from 'supertest';
import { createApp } from '../../../src/app-factory';
import { resetDatabase, testAppConfig } from '../../helpers/testDb';

const appConfig = testAppConfig();
const app = createApp(appConfig);

beforeEach(async () => {
  await resetDatabase(appConfig.databaseUrl);
});

async function createCustomer(overrides: Record<string, unknown> = {}) {
  return request(app).post('/v1/customers').send({
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phoneNumber: '+1-555-0100',
    ...overrides,
  });
}

describe('Customers CRUD', () => {
  it('creates a valid customer and returns the data envelope in camelCase', async () => {
    const res = await createCustomer();
    expect(res.status).toBe(201);
    expect(res.body.error).toBeUndefined();
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toEqual({});
    expect(res.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.body.data.fullName).toBe('Jane Doe');
    expect(res.body.data.email).toBe('jane@example.com');
    expect(res.body.data.phoneNumber).toBe('+1-555-0100');
  });

  it('creates a customer without an optional phoneNumber', async () => {
    const res = await createCustomer({ phoneNumber: undefined });
    expect(res.status).toBe(201);
    expect(res.body.data.phoneNumber).toBeNull();
  });

  it('generates non-sequential unique IDs across creates', async () => {
    const a = await createCustomer({ email: 'a@example.com' });
    const b = await createCustomer({ email: 'b@example.com' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('returns 400 when a required field is missing', async () => {
    const res = await createCustomer({ email: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.data).toBeUndefined();
  });

  it('returns 400 for a malformed (non-UUID) ID', async () => {
    const res = await request(app).get('/v1/customers/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when getting a nonexistent customer', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/customers/${missing}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when updating a nonexistent customer', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/v1/customers/${missing}`).send({ fullName: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates an existing customer', async () => {
    const created = await createCustomer();
    const res = await request(app)
      .patch(`/v1/customers/${created.body.data.id}`)
      .send({ fullName: 'Janet Doe', phoneNumber: '+1-555-0200' });
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Janet Doe');
    expect(res.body.data.phoneNumber).toBe('+1-555-0200');
    expect(res.body.data.email).toBe('jane@example.com');
  });

  it('lists customers with a meta.total', async () => {
    await createCustomer({ email: 'a@example.com' });
    await createCustomer({ email: 'b@example.com' });
    const res = await request(app).get('/v1/customers');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('rejects deleting a customer with dependent bookings with 409 and does not delete it', async () => {
    const customerRes = await createCustomer();
    const customerId = customerRes.body.data.id;

    const airlineRes = await request(app).post('/v1/airlines').send({
      name: 'Test Airlines',
      code: 'TA',
      country: 'Testland',
    });
    const flightRes = await request(app)
      .post('/v1/flights')
      .send({
        airlineId: airlineRes.body.data.id,
        flightNumber: 'TA101',
        origin: 'Alpha',
        destination: 'Beta',
        departureTime: '2026-10-01T10:00:00.000Z',
        arrivalTime: '2026-10-01T12:00:00.000Z',
        price: 199.5,
        seatCapacity: 150,
      });

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId,
        flightId: flightRes.body.data.id,
        bookingTimestamp: '2026-09-16T10:00:00.000Z',
      })
      .expect(201);

    const del = await request(app).delete(`/v1/customers/${customerId}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CONFLICT');

    const check = await request(app).get(`/v1/customers/${customerId}`);
    expect(check.status).toBe(200);
  });

  it('deletes a customer with no dependents', async () => {
    const customerRes = await createCustomer();
    const customerId = customerRes.body.data.id;

    const del = await request(app).delete(`/v1/customers/${customerId}`);
    expect(del.status).toBe(200);

    const check = await request(app).get(`/v1/customers/${customerId}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a nonexistent customer', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/v1/customers/${missing}`);
    expect(res.status).toBe(404);
  });
});

describe('Customers relationship-scoped bookings list', () => {
  it('returns only bookings belonging to the given customer', async () => {
    const customerA = await createCustomer({ email: 'a@example.com' });
    const customerB = await createCustomer({ email: 'b@example.com' });

    const airlineRes = await request(app).post('/v1/airlines').send({
      name: 'Test Airlines',
      code: 'TA',
      country: 'Testland',
    });
    const flightRes = await request(app).post('/v1/flights').send({
      airlineId: airlineRes.body.data.id,
      flightNumber: 'TA101',
      origin: 'Alpha',
      destination: 'Beta',
      departureTime: '2026-10-01T10:00:00.000Z',
      arrivalTime: '2026-10-01T12:00:00.000Z',
      price: 199.5,
      seatCapacity: 150,
    });
    const flightId = flightRes.body.data.id;

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId: customerA.body.data.id,
        flightId,
        bookingTimestamp: '2026-09-16T10:00:00.000Z',
      })
      .expect(201);

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId: customerB.body.data.id,
        flightId,
        bookingTimestamp: '2026-09-16T11:00:00.000Z',
      })
      .expect(201);

    const res = await request(app).get(`/v1/customers/${customerA.body.data.id}/bookings`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customerId).toBe(customerA.body.data.id);
    expect(res.body.data[0].flightId).toBe(flightId);
  });

  it('returns an empty list for a customer with no bookings', async () => {
    const customer = await createCustomer();
    const res = await request(app).get(`/v1/customers/${customer.body.data.id}/bookings`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it('returns 404 when the parent customer does not exist', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/customers/${missing}/bookings`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Customers list endpoint: pagination, filtering, sorting', () => {
  it('defaults to limit 20 and reports hasMore across pages', async () => {
    for (let i = 0; i < 25; i += 1) {
      await createCustomer({ fullName: `Person ${i}`, email: `user${i}@example.com` });
    }

    const page1 = await request(app).get('/v1/customers');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 25, hasMore: true });

    const page2 = await request(app).get('/v1/customers?offset=20');
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.meta).toMatchObject({ limit: 20, offset: 20, total: 25, hasMore: false });
  });

  it('accepts limit=100 and rejects invalid pagination values with 400', async () => {
    await createCustomer();

    const ok = await request(app).get('/v1/customers?limit=100');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(100);

    for (const q of ['limit=101', 'limit=0', 'limit=abc', 'offset=-1', 'offset=abc']) {
      const res = await request(app).get(`/v1/customers?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects an unsupported filter field with 400', async () => {
    const res = await request(app).get('/v1/customers?age=30');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('filters customers by fullName and email (case-insensitive contains)', async () => {
    await createCustomer({ fullName: 'Jane Doe', email: 'jane@example.com' });
    await createCustomer({ fullName: 'John Doe', email: 'john@example.com' });
    await createCustomer({ fullName: 'Alice Smith', email: 'alice@example.com' });

    const byName = await request(app).get('/v1/customers?fullName=doe');
    expect(byName.status).toBe(200);
    expect(byName.body.meta.total).toBe(2);

    const byEmail = await request(app).get('/v1/customers?email=JANE');
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0].email).toBe('jane@example.com');
  });

  it('sorts customers by fullName and rejects invalid sort/order', async () => {
    await createCustomer({ fullName: 'Charlie', email: 'c@example.com' });
    await createCustomer({ fullName: 'Alpha', email: 'a@example.com' });
    await createCustomer({ fullName: 'Bravo', email: 'b@example.com' });

    const asc = await request(app).get('/v1/customers?sort=fullName&order=asc');
    expect(asc.status).toBe(200);
    expect(asc.body.data.map((c: { fullName: string }) => c.fullName)).toEqual(['Alpha', 'Bravo', 'Charlie']);

    const desc = await request(app).get('/v1/customers?sort=fullName&order=desc');
    expect(desc.body.data.map((c: { fullName: string }) => c.fullName)).toEqual(['Charlie', 'Bravo', 'Alpha']);

    expect((await request(app).get('/v1/customers?sort=age')).status).toBe(400);
    expect((await request(app).get('/v1/customers?sort=fullName&order=sideways')).status).toBe(400);
    expect((await request(app).get('/v1/customers?order=asc')).status).toBe(400);
  });

  it('paginates the bookings list for a customer and applies a child filter (relationship list)', async () => {
    const customer = await createCustomer();
    const customerId = customer.body.data.id;

    const airlineRes = await request(app).post('/v1/airlines').send({
      name: 'Test Airlines',
      code: 'TA',
      country: 'Testland',
    });
    const flightABase = { airlineId: airlineRes.body.data.id };
    const flightARes = await request(app).post('/v1/flights').send({ ...flightABase, flightNumber: 'TA101', origin: 'Alpha', destination: 'Beta', departureTime: '2026-10-01T10:00:00.000Z', arrivalTime: '2026-10-01T12:00:00.000Z', price: 199.5, seatCapacity: 150 });
    const flightBRes = await request(app).post('/v1/flights').send({ ...flightABase, flightNumber: 'TA102', origin: 'Alpha', destination: 'Gamma', departureTime: '2026-10-02T10:00:00.000Z', arrivalTime: '2026-10-02T12:00:00.000Z', price: 299.5, seatCapacity: 150 });

    for (let i = 0; i < 22; i += 1) {
      await request(app)
        .post('/v1/bookings')
        .send({ customerId, flightId: flightARes.body.data.id, bookingTimestamp: '2026-09-16T10:00:00.000Z' })
        .expect(201);
    }
    await request(app)
      .post('/v1/bookings')
      .send({ customerId, flightId: flightBRes.body.data.id, bookingTimestamp: '2026-09-16T11:00:00.000Z' })
      .expect(201);

    const page1 = await request(app).get(`/v1/customers/${customerId}/bookings`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 23, hasMore: true });

    const filtered = await request(app).get(`/v1/customers/${customerId}/bookings?flightId=${flightBRes.body.data.id}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.data[0].flightId).toBe(flightBRes.body.data.id);
  });
});