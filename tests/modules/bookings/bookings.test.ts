import request from 'supertest';
import { createApp } from '../../../src/app-factory';
import { resetDatabase, testAppConfig } from '../../helpers/testDb';

const appConfig = testAppConfig();
const app = createApp(appConfig);

beforeEach(async () => {
  await resetDatabase(appConfig.databaseUrl);
});

async function createAirline() {
  const res = await request(app).post('/v1/airlines').send({
    name: 'Test Airlines',
    code: 'TA',
    country: 'Testland',
  });
  return res.body.data.id;
}

async function createFlight(overrides: Record<string, unknown> = {}) {
  const airlineId = await createAirline();
  const res = await request(app).post('/v1/flights').send({
    airlineId,
    flightNumber: 'TA101',
    origin: 'Alpha',
    destination: 'Beta',
    departureTime: '2026-10-01T10:00:00.000Z',
    arrivalTime: '2026-10-01T12:00:00.000Z',
    price: 199.5,
    seatCapacity: 150,
    ...overrides,
  });
  return res.body.data.id;
}

async function createCustomer(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/v1/customers').send({
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    ...overrides,
  });
  return res.body.data.id;
}

function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    customerId: '00000000-0000-0000-0000-000000000000',
    flightId: '00000000-0000-0000-0000-000000000000',
    bookingTimestamp: '2026-09-16T10:00:00.000Z',
    seatsBooked: 1,
    ...overrides,
  };
}

describe('Bookings CRUD', () => {
  it('creates a valid booking and returns the data envelope in camelCase', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const res = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    expect(res.status).toBe(201);
    expect(res.body.error).toBeUndefined();
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toEqual({});
    expect(res.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.body.data.customerId).toBe(customerId);
    expect(res.body.data.flightId).toBe(flightId);
    expect(res.body.data.bookingTimestamp).toBeDefined();
    expect(res.body.data.seatsBooked).toBe(1);
  });

  it('defaults seatsBooked to 1 when omitted', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const res = await request(app)
      .post('/v1/bookings')
      .send(bookingBody({ customerId, flightId, seatsBooked: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data.seatsBooked).toBe(1);
  });

  it('generates non-sequential unique IDs across creates', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const a = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    const b = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('returns 400 when a required field is missing', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const res = await request(app)
      .post('/v1/bookings')
      .send(bookingBody({ customerId, flightId, bookingTimestamp: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.data).toBeUndefined();
  });

  it('returns 404 when the customer does not exist', async () => {
    const flightId = await createFlight();
    const res = await request(app).post('/v1/bookings').send(bookingBody({ flightId }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Customer');
  });

  it('returns 404 when the flight does not exist', async () => {
    const customerId = await createCustomer();
    const res = await request(app).post('/v1/bookings').send(bookingBody({ customerId }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Flight');
  });

  it('returns 400 for a malformed (non-UUID) ID', async () => {
    const res = await request(app).get('/v1/bookings/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when getting a nonexistent booking', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/bookings/${missing}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose an update route for bookings (PATCH returns 404/405)', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const created = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    const bookingId = created.body.data.id;

    const res = await request(app).patch(`/v1/bookings/${bookingId}`).send({ seatsBooked: 5 });
    expect([404, 405]).toContain(res.status);
  });

  it('does not expose an update route for bookings (PUT returns 404/405)', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const created = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    const bookingId = created.body.data.id;

    const res = await request(app).put(`/v1/bookings/${bookingId}`).send({ seatsBooked: 5 });
    expect([404, 405]).toContain(res.status);
  });

  it('lists bookings with a meta.total', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    const res = await request(app).get('/v1/bookings');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('deletes a booking successfully — deletion always allowed (represents cancellation)', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const created = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    const bookingId = created.body.data.id;

    const del = await request(app).delete(`/v1/bookings/${bookingId}`);
    expect(del.status).toBe(200);

    const check = await request(app).get(`/v1/bookings/${bookingId}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a nonexistent booking', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/v1/bookings/${missing}`);
    expect(res.status).toBe(404);
  });
});

describe('Bookings capacity and state rules', () => {
  it('does not validate a booking against remaining seat capacity (overbooking allowed)', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight({ seatCapacity: 1 });
    const res = await request(app)
      .post('/v1/bookings')
      .send(bookingBody({ customerId, flightId, seatsBooked: 5 }));
    expect(res.status).toBe(201);
    expect(res.body.data.seatsBooked).toBe(5);
  });

  it('has no status field on the booking payload', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    const created = await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId }));
    expect(created.body.data.status).toBeUndefined();

    const check = await request(app).get(`/v1/bookings/${created.body.data.id}`);
    expect(check.body.data.status).toBeUndefined();
  });
});

describe('Bookings list endpoint: pagination, filtering, sorting', () => {
  it('accepts limit=100 and rejects invalid pagination values with 400', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId })).expect(201);

    const ok = await request(app).get('/v1/bookings?limit=100');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(100);

    for (const q of ['limit=101', 'limit=0', 'limit=abc', 'offset=-1', 'offset=abc']) {
      const res = await request(app).get(`/v1/bookings?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects an unsupported filter field with 400', async () => {
    const res = await request(app).get('/v1/bookings?referrer=web');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('defaults to limit 20 and reports hasMore across pages', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();
    for (let i = 0; i < 25; i += 1) {
      await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId })).expect(201);
    }

    const page1 = await request(app).get('/v1/bookings');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 25, hasMore: true });

    const page2 = await request(app).get('/v1/bookings?offset=20');
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.meta).toMatchObject({ limit: 20, offset: 20, total: 25, hasMore: false });
  });

  it('filters bookings by customerId and flightId and rejects invalid UUID values', async () => {
    const customerA = await createCustomer({ email: 'a@example.com' });
    const customerB = await createCustomer({ email: 'b@example.com' });
    const flightA = await createFlight({ flightNumber: 'TA111' });
    const flightB = await createFlight({ flightNumber: 'TA112' });

    await request(app).post('/v1/bookings').send(bookingBody({ customerId: customerA, flightId: flightA })).expect(201);
    await request(app).post('/v1/bookings').send(bookingBody({ customerId: customerA, flightId: flightB })).expect(201);
    await request(app).post('/v1/bookings').send(bookingBody({ customerId: customerB, flightId: flightA })).expect(201);

    const byCustomer = await request(app).get(`/v1/bookings?customerId=${customerA}`);
    expect(byCustomer.status).toBe(200);
    expect(byCustomer.body.meta.total).toBe(2);

    const byFlight = await request(app).get(`/v1/bookings?flightId=${flightA}`);
    expect(byFlight.body.meta.total).toBe(2);

    const both = await request(app).get(`/v1/bookings?customerId=${customerA}&flightId=${flightB}`);
    expect(both.body.meta.total).toBe(1);

    expect((await request(app).get('/v1/bookings?customerId=not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/v1/bookings?flightId=123')).status).toBe(400);
  });

  it('sorts bookings by bookingTimestamp and seatsBooked and rejects invalid sort/order', async () => {
    const customerId = await createCustomer();
    const flightId = await createFlight();

    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId, bookingTimestamp: '2026-09-16T10:00:00.000Z', seatsBooked: 2 })).expect(201);
    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId, bookingTimestamp: '2026-09-17T10:00:00.000Z', seatsBooked: 1 })).expect(201);
    await request(app).post('/v1/bookings').send(bookingBody({ customerId, flightId, bookingTimestamp: '2026-09-18T10:00:00.000Z', seatsBooked: 3 })).expect(201);

    const byTimeDesc = await request(app).get('/v1/bookings?sort=bookingTimestamp&order=desc');
    expect(byTimeDesc.status).toBe(200);
    expect(byTimeDesc.body.data.map((b: { bookingTimestamp: string }) => b.bookingTimestamp.slice(0, 10))).toEqual(['2026-09-18', '2026-09-17', '2026-09-16']);

    const bySeatsAsc = await request(app).get('/v1/bookings?sort=seatsBooked&order=asc');
    expect(bySeatsAsc.body.data.map((b: { seatsBooked: number }) => b.seatsBooked)).toEqual([1, 2, 3]);

    expect((await request(app).get('/v1/bookings?sort=status')).status).toBe(400);
    expect((await request(app).get('/v1/bookings?sort=bookingTimestamp&order=sideways')).status).toBe(400);
    expect((await request(app).get('/v1/bookings?order=asc')).status).toBe(400);
  });
});