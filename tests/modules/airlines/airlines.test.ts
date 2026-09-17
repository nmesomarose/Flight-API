import request from 'supertest';
import { createApp } from '../../../src/app';
import { resetDatabase, testAppConfig } from '../../helpers/testDb';

const appConfig = testAppConfig();
const app = createApp(appConfig);

beforeEach(async () => {
  await resetDatabase(appConfig.databaseUrl);
});

async function createAirline(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/v1/airlines').send({
    name: 'Test Airlines',
    code: 'TA',
    country: 'Testland',
    ...overrides,
  });
  return res;
}

describe('Airlines CRUD', () => {
  it('creates a valid airline and returns the data envelope shape', async () => {
    const res = await createAirline();
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toEqual({});
    expect(res.body.error).toBeUndefined();
    expect(res.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.body.data.name).toBe('Test Airlines');
    expect(res.body.data.code).toBe('TA');
    expect(res.body.data.country).toBe('Testland');
  });

  it('generates non-sequential unique IDs across creates', async () => {
    const a = await createAirline({ code: 'AA', name: 'Alpha Airways' });
    const b = await createAirline({ code: 'BB', name: 'Beta Airways' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('returns 400 when a required field is missing', async () => {
    const res = await createAirline({ code: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBeDefined();
    expect(res.body.error.message).toBeDefined();
    expect(res.body.data).toBeUndefined();
  });

  it('returns 400 for a malformed (non-UUID) ID', async () => {
    const res = await request(app).get('/v1/airlines/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when getting a nonexistent airline', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/airlines/${missing}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when updating a nonexistent airline', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/v1/airlines/${missing}`).send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates an existing airline', async () => {
    const created = await createAirline();
    const res = await request(app)
      .patch(`/v1/airlines/${created.body.data.id}`)
      .send({ name: 'Renamed Airlines' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Airlines');
    expect(res.body.data.code).toBe('TA');
  });

  it('lists airlines with a meta.total', async () => {
    await createAirline({ code: 'AA' });
    await createAirline({ code: 'BB' });
    const res = await request(app).get('/v1/airlines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('rejects deleting an airline with dependent flights with 409 and does not delete it', async () => {
    const airline = await createAirline();
    const airlineId = airline.body.data.id;

    await request(app)
      .post('/v1/flights')
      .send({
        airlineId,
        flightNumber: 'TA101',
        origin: 'Alpha',
        destination: 'Beta',
        departureTime: '2026-10-01T10:00:00.000Z',
        arrivalTime: '2026-10-01T12:00:00.000Z',
        price: 199.5,
        seatCapacity: 150,
      })
      .expect(201);

    const del = await request(app).delete(`/v1/airlines/${airlineId}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CONFLICT');

    const check = await request(app).get(`/v1/airlines/${airlineId}`);
    expect(check.status).toBe(200);
  });

  it('deletes an airline with no dependents', async () => {
    const airline = await createAirline();
    const airlineId = airline.body.data.id;

    const del = await request(app).delete(`/v1/airlines/${airlineId}`);
    expect(del.status).toBe(200);

    const check = await request(app).get(`/v1/airlines/${airlineId}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a nonexistent airline', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/v1/airlines/${missing}`);
    expect(res.status).toBe(404);
  });
});

describe('Airlines relationship-scoped flights list', () => {
  it('returns only flights belonging to the given airline', async () => {
    const airlineA = await createAirline({ code: 'AA', name: 'Alpha Airways' });
    const airlineB = await createAirline({ code: 'BB', name: 'Beta Airways' });

    await request(app)
      .post('/v1/flights')
      .send({
        airlineId: airlineA.body.data.id,
        flightNumber: 'AA101',
        origin: 'Alpha',
        destination: 'Beta',
        departureTime: '2026-10-01T10:00:00.000Z',
        arrivalTime: '2026-10-01T12:00:00.000Z',
        price: 199.5,
        seatCapacity: 150,
      })
      .expect(201);

    await request(app)
      .post('/v1/flights')
      .send({
        airlineId: airlineB.body.data.id,
        flightNumber: 'BB101',
        origin: 'Beta',
        destination: 'Gamma',
        departureTime: '2026-10-01T10:00:00.000Z',
        arrivalTime: '2026-10-01T12:00:00.000Z',
        price: 299.5,
        seatCapacity: 150,
      })
      .expect(201);

    const res = await request(app).get(`/v1/airlines/${airlineA.body.data.id}/flights`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].airlineId).toBe(airlineA.body.data.id);
    expect(res.body.data[0].flightNumber).toBe('AA101');
  });

  it('returns an empty list for an airline with no flights', async () => {
    const airline = await createAirline();
    const res = await request(app).get(`/v1/airlines/${airline.body.data.id}/flights`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it('returns 404 when the parent airline does not exist', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/v1/airlines/${missing}/flights`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Airlines list endpoint: pagination, filtering, sorting', () => {
  function createFlightFor(airlineId: string, overrides: Record<string, unknown> = {}) {
    return request(app).post('/v1/flights').send({
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
  }

  it('defaults to limit 20 and reports hasMore across pages', async () => {
    for (let i = 0; i < 25; i += 1) {
      await createAirline({ code: `AA${String(i).padStart(2, '0')}`, name: `Airline ${i}` });
    }
    const page1 = await request(app).get('/v1/airlines');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 25, hasMore: true });

    const page2 = await request(app).get('/v1/airlines?offset=20');
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.meta).toMatchObject({ limit: 20, offset: 20, total: 25, hasMore: false });
  });

  it('accepts limit=100 and rejects invalid pagination values with 400', async () => {
    await createAirline();

    const ok = await request(app).get('/v1/airlines?limit=100');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(100);

    for (const q of ['limit=101', 'limit=0', 'limit=abc', 'limit=-5', 'offset=-1', 'offset=abc']) {
      const res = await request(app).get(`/v1/airlines?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects an unsupported filter field with 400', async () => {
    const res = await request(app).get('/v1/airlines?color=blue');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('filters airlines by name (case-insensitive contains), code (exact), and country (exact)', async () => {
    await createAirline({ name: 'Alpha Airways', code: 'AA', country: 'Atlantis' });
    await createAirline({ name: 'Beta Airways', code: 'BB', country: 'Bermuda' });
    await createAirline({ name: 'Gamma Cargo', code: 'GC', country: 'Atlantis' });

    const byName = await request(app).get('/v1/airlines?name=airways');
    expect(byName.status).toBe(200);
    expect(byName.body.meta.total).toBe(2);

    const byCode = await request(app).get('/v1/airlines?code=BB');
    expect(byCode.status).toBe(200);
    expect(byCode.body.data).toHaveLength(1);
    expect(byCode.body.data[0].code).toBe('BB');

    const byCountry = await request(app).get('/v1/airlines?country=Atlantis');
    expect(byCountry.status).toBe(200);
    expect(byCountry.body.meta.total).toBe(2);
  });

  it('sorts airlines by name and rejects invalid sort/order', async () => {
    await createAirline({ name: 'Charlie', code: 'CC' });
    await createAirline({ name: 'Alpha', code: 'AA' });
    await createAirline({ name: 'Bravo', code: 'BB' });

    const asc = await request(app).get('/v1/airlines?sort=name&order=asc');
    expect(asc.status).toBe(200);
    expect(asc.body.data.map((a: { name: string }) => a.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);

    const desc = await request(app).get('/v1/airlines?sort=name&order=desc');
    expect(desc.body.data.map((a: { name: string }) => a.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);

    expect((await request(app).get('/v1/airlines?sort=color')).status).toBe(400);
    expect((await request(app).get('/v1/airlines?sort=name&order=sideways')).status).toBe(400);
    expect((await request(app).get('/v1/airlines?order=asc')).status).toBe(400);
  });

  it('paginates the flights list for an airline (relationship list)', async () => {
    const airline = await createAirline();
    const airlineId = airline.body.data.id;
    for (let i = 0; i < 22; i += 1) {
      await createFlightFor(airlineId, { flightNumber: `TA${String(i).padStart(2, '0')}` }).expect(201);
    }

    const page1 = await request(app).get(`/v1/airlines/${airlineId}/flights`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.meta).toMatchObject({ limit: 20, offset: 0, total: 22, hasMore: true });

    const page2 = await request(app).get(`/v1/airlines/${airlineId}/flights?offset=20`);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.meta).toMatchObject({ offset: 20, total: 22, hasMore: false });
  });

  it('applies child-resource filters on the flights-by-airline list', async () => {
    const airline = await createAirline();
    const airlineId = airline.body.data.id;
    await createFlightFor(airlineId, { flightNumber: 'TZ1', destination: 'Zulu' }).expect(201);
    await createFlightFor(airlineId, { flightNumber: 'TA1' }).expect(201);

    const res = await request(app).get(`/v1/airlines/${airlineId}/flights?destination=Zulu`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].flightNumber).toBe('TZ1');
  });
});