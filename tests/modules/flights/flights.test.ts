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
  return res.body.data;
}

function flightBody(overrides: Record<string, unknown> = {}) {
  return {
    airlineId: '00000000-0000-0000-0000-000000000000',
    flightNumber: 'TA101',
    origin: 'Alpha',
    destination: 'Beta',
    departureTime: '2026-10-01T10:00:00.000Z',
    arrivalTime: '2026-10-01T12:00:00.000Z',
    price: 199.5,
    seatCapacity: 150,
    ...overrides,
  };
}

describe('Flights CRUD', () => {
  it('creates a valid flight and returns the data envelope in camelCase', async () => {
    const airline = await createAirline();
    const res = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    expect(res.status).toBe(201);
    expect(res.body.error).toBeUndefined();
    expect(res.body.data).toBeDefined();
    expect(res.body.data.airlineId).toBe(airline.id);
    expect(res.body.data.flightNumber).toBe('TA101');
    expect(res.body.data.origin).toBe('Alpha');
    expect(res.body.data.destination).toBe('Beta');
    expect(res.body.data.departureTime).toBeDefined();
    expect(res.body.data.arrivalTime).toBeDefined();
    expect(res.body.data.price).toBe(199.5);
    expect(res.body.data.seatCapacity).toBe(150);
    expect(res.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates non-sequential unique IDs across creates', async () => {
    const airline = await createAirline();
    const a = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA111' }));
    const b = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA112' }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('returns 400 when a required field is missing', async () => {
    const airline = await createAirline();
    const { flightNumber, ...rest } = flightBody({ airlineId: airline.id });
    const res = await request(app).post('/v1/flights').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.data).toBeUndefined();
  });

  it('returns 400 for an invalid ISO datetime', async () => {
    const airline = await createAirline();
    const res = await request(app)
      .post('/v1/flights')
      .send(flightBody({ airlineId: airline.id, departureTime: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) when price is a non-finite JSON number', async () => {
    const airline = await createAirline();
    // A raw out-of-range numeric literal parses to Infinity under JSON.parse,
    // which is a malformed request and must be rejected as 400 (data-integrity.md).
    const raw =
      `{"airlineId":"${airline.id}","flightNumber":"TA101","origin":"Alpha",` +
      `"destination":"Beta","departureTime":"2026-10-01T10:00:00.000Z",` +
      `"arrivalTime":"2026-10-01T12:00:00.000Z","price":1e309,"seatCapacity":150}`;
    const res = await request(app)
      .post('/v1/flights')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when creating a flight with a nonexistent airlineId', async () => {
    const res = await request(app).post('/v1/flights').send(flightBody());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed (non-UUID) ID', async () => {
    const res = await request(app).get('/v1/flights/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when getting a nonexistent flight', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/flights/${missing}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when updating a nonexistent flight', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/v1/flights/${missing}`).send({ origin: 'Zulu' });
    expect(res.status).toBe(404);
  });

  it('updates an existing flight', async () => {
    const airline = await createAirline();
    const created = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    const res = await request(app)
      .patch(`/v1/flights/${created.body.data.id}`)
      .send({ origin: 'Zulu', price: 250 });
    expect(res.status).toBe(200);
    expect(res.body.data.origin).toBe('Zulu');
    expect(res.body.data.price).toBe(250);
    expect(res.body.data.flightNumber).toBe('TA101');
  });

  it('returns 404 when updating a flight to a nonexistent airline', async () => {
    const airline = await createAirline();
    const created = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .patch(`/v1/flights/${created.body.data.id}`)
      .send({ airlineId: missing });
    expect(res.status).toBe(404);
  });

  it('returns 400 (not 500) when updating a flight with a non-finite JSON price', async () => {
    const airline = await createAirline();
    const created = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    const res = await request(app)
      .patch(`/v1/flights/${created.body.data.id}`)
      .set('Content-Type', 'application/json')
      .send('{"price":1e309}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('lists flights with a meta.total', async () => {
    const airline = await createAirline();
    await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA111' }));
    await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA112' }));
    const res = await request(app).get('/v1/flights');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('rejects deleting a flight with dependent bookings with 409 and does not delete it', async () => {
    const airline = await createAirline();
    const flightRes = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    const flightId = flightRes.body.data.id;

    const customerRes = await request(app).post('/v1/customers').send({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    });
    const customerId = customerRes.body.data.id;

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId,
        flightId,
        bookingTimestamp: '2026-09-16T10:00:00.000Z',
        seatsBooked: 1,
      })
      .expect(201);

    const del = await request(app).delete(`/v1/flights/${flightId}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CONFLICT');

    const check = await request(app).get(`/v1/flights/${flightId}`);
    expect(check.status).toBe(200);
  });

  it('deletes a flight with no dependents', async () => {
    const airline = await createAirline();
    const flightRes = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id }));
    const flightId = flightRes.body.data.id;

    const del = await request(app).delete(`/v1/flights/${flightId}`);
    expect(del.status).toBe(200);

    const check = await request(app).get(`/v1/flights/${flightId}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a nonexistent flight', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/v1/flights/${missing}`);
    expect(res.status).toBe(404);
  });
});

describe('Flights relationship-scoped bookings list', () => {
  it('returns only bookings belonging to the given flight', async () => {
    const airline = await createAirline();
    const flightA = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA111' }));
    const flightB = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA112' }));

    const customerRes = await request(app).post('/v1/customers').send({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    });
    const customerId = customerRes.body.data.id;

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId,
        flightId: flightA.body.data.id,
        bookingTimestamp: '2026-09-16T10:00:00.000Z',
      })
      .expect(201);

    await request(app)
      .post('/v1/bookings')
      .send({
        customerId,
        flightId: flightB.body.data.id,
        bookingTimestamp: '2026-09-16T11:00:00.000Z',
      })
      .expect(201);

    const res = await request(app).get(`/v1/flights/${flightA.body.data.id}/bookings`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].flightId).toBe(flightA.body.data.id);
    expect(res.body.data[0].customerId).toBe(customerId);
  });

  it('returns 404 when the parent flight does not exist', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/flights/${missing}/bookings`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Flights list endpoint: pagination, filtering, sorting', () => {
  it('defaults to limit 20 and reports hasMore across pages', async () => {
    const airline = await createAirline();
    for (let i = 0; i < 25; i += 1) {
      await request(app)
        .post('/v1/flights')
        .send(flightBody({ airlineId: airline.id, flightNumber: `TA${String(i).padStart(2, '0')}` }))
        .expect(201);
    }

    const page1 = await request(app).get('/v1/flights');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 25, hasMore: true });

    const page2 = await request(app).get('/v1/flights?offset=20');
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.meta).toMatchObject({ limit: 20, offset: 20, total: 25, hasMore: false });
  });

  it('accepts limit=100 and rejects invalid pagination values with 400', async () => {
    const airline = await createAirline();
    await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA1' })).expect(201);

    const ok = await request(app).get('/v1/flights?limit=100');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(100);

    for (const q of ['limit=101', 'limit=0', 'limit=abc', 'offset=-1', 'offset=abc']) {
      const res = await request(app).get(`/v1/flights?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects an unsupported filter field with 400', async () => {
    const res = await request(app).get('/v1/flights?gate=12');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('filters flights by origin, destination, and departure date', async () => {
    const airline = await createAirline();
    const base = { airlineId: airline.id };
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA1', origin: 'Alpha', destination: 'Beta', departureTime: '2026-10-01T08:00:00.000Z' })).expect(201);
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA2', origin: 'Alpha', destination: 'Gamma', departureTime: '2026-10-01T22:00:00.000Z' })).expect(201);
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA3', origin: 'Zulu', destination: 'Beta', departureTime: '2026-10-02T08:00:00.000Z' })).expect(201);

    const byOrigin = await request(app).get('/v1/flights?origin=Alpha');
    expect(byOrigin.status).toBe(200);
    expect(byOrigin.body.meta.total).toBe(2);

    const byDest = await request(app).get('/v1/flights?destination=Beta');
    expect(byDest.body.meta.total).toBe(2);

    const byDate = await request(app).get('/v1/flights?date=2026-10-01');
    expect(byDate.status).toBe(200);
    expect(byDate.body.meta.total).toBe(2);

    const nextDay = await request(app).get('/v1/flights?date=2026-10-02');
    expect(nextDay.body.meta.total).toBe(1);
  });

  it('rejects an invalid date filter with 400', async () => {
    for (const q of ['date=2026-13-01', 'date=not-a-date', 'date=01-10-2026']) {
      const res = await request(app).get(`/v1/flights?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('sorts flights by departureTime and price and rejects invalid sort/order', async () => {
    const airline = await createAirline();
    const base = { airlineId: airline.id };
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA1', departureTime: '2026-10-01T08:00:00.000Z', price: 300 })).expect(201);
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA2', departureTime: '2026-10-01T09:00:00.000Z', price: 100 })).expect(201);
    await request(app).post('/v1/flights').send(flightBody({ ...base, flightNumber: 'TA3', departureTime: '2026-10-01T10:00:00.000Z', price: 200 })).expect(201);

    const byTime = await request(app).get('/v1/flights?sort=departureTime&order=asc');
    expect(byTime.status).toBe(200);
    expect(byTime.body.data.map((f: { flightNumber: string }) => f.flightNumber)).toEqual(['TA1', 'TA2', 'TA3']);

    const byTimeDesc = await request(app).get('/v1/flights?sort=departureTime&order=desc');
    expect(byTimeDesc.body.data.map((f: { flightNumber: string }) => f.flightNumber)).toEqual(['TA3', 'TA2', 'TA1']);

    const byPrice = await request(app).get('/v1/flights?sort=price&order=asc');
    expect(byPrice.body.data.map((f: { price: number }) => f.price)).toEqual([100, 200, 300]);

    expect((await request(app).get('/v1/flights?sort=color')).status).toBe(400);
    expect((await request(app).get('/v1/flights?sort=departureTime&order=sideways')).status).toBe(400);
    expect((await request(app).get('/v1/flights?order=desc')).status).toBe(400);
  });

  it('paginates the bookings list for a flight and applies a child filter (relationship list)', async () => {
    const airline = await createAirline();
    const flightRes = await request(app).post('/v1/flights').send(flightBody({ airlineId: airline.id, flightNumber: 'TA111' }));
    const flightId = flightRes.body.data.id;

    const customerA = await request(app).post('/v1/customers').send({ fullName: 'Jane Doe', email: 'jane@example.com' });
    const customerB = await request(app).post('/v1/customers').send({ fullName: 'John Doe', email: 'john@example.com' });

    for (let i = 0; i < 22; i += 1) {
      await request(app)
        .post('/v1/bookings')
        .send({ customerId: customerA.body.data.id, flightId, bookingTimestamp: '2026-09-16T10:00:00.000Z' })
        .expect(201);
    }
    await request(app)
      .post('/v1/bookings')
      .send({ customerId: customerB.body.data.id, flightId, bookingTimestamp: '2026-09-16T11:00:00.000Z' })
      .expect(201);

    const page1 = await request(app).get(`/v1/flights/${flightId}/bookings`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 23, hasMore: true });

    const filtered = await request(app).get(`/v1/flights/${flightId}/bookings?customerId=${customerB.body.data.id}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.data[0].customerId).toBe(customerB.body.data.id);
  });
});