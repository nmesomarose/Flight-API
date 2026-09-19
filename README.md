# Flight Booking REST API

A backend-focused demonstration project that models a simplified flight-booking
domain over HTTP. It exposes four related resources — **Airlines**, **Flights**,
**Customers**, and **Bookings** — with correct relational integrity, consistent
REST conventions (versioning, pagination, filtering, sorting, response/error
envelopes), and basic production hygiene (configurable rate limiting).

The **API itself is the primary product**. A minimal external consumer client is
included only to prove that the API is consumable by a system outside its own
codebase — it is a supporting artifact, not a second product.

This document describes the system as it is actually implemented. The contract
is governed by `flight-booking-api-prd-v2.md` (product source of truth),
`AGENTS.md`, and the rule files under `.agents/rules/`.

---

## 1. Project Overview

The Flight Booking REST API models a simplified, realistic flight-booking
domain:

| Resource  | What it represents                                            |
| --------- | ------------------------------------------------------------- |
| Airline   | A company that operates flights (e.g., "Skyline Airways").    |
| Flight    | A single scheduled, dated flight instance operated by an airline. |
| Customer  | A person who can make bookings.                               |
| Booking   | A single customer's reservation on a single flight.           |

The API demonstrates competence in REST API design and relational data
modeling — not a replication of a commercial airline booking system.

**The API is the deliverable.** The minimal consumer client (`client/`) exists
solely to prove the API works when consumed independently over HTTP.

**Intentionally excluded from scope** (per PRD §8):
- Authentication, authorization, login, or user accounts.
- Payment processing or payment simulation.
- Integration with real airline data providers or external booking systems.
- Admin dashboards or any management UI.
- Booking status, holds, cancellation-as-a-status, refunds, or waitlists.
- Multi-leg / connecting-flight itineraries.
- Seat maps, fare classes, loyalty programs, baggage handling.
- Notifications or emails.
- Live/real-time behavior: no live flight status, no dynamic pricing, no live
  seat-availability decrementing.

`seat_capacity` is informational only and is **not** validated against at
booking time (PRD §5 item 5). Overbooking is not prevented.

---

## 2. Technology Stack

The actual stack installed in this repository:

| Layer             | Technology                                      | Version        |
| ----------------- | ----------------------------------------------- | -------------- |
| Runtime           | Node.js (requires `>= 24` per `package.json`)   | —              |
| Language          | TypeScript                                      | 5.9.3          |
| Web framework     | Express                                         | 5.2.1          |
| Database          | PostgreSQL                                      | —              |
| ORM / query layer | Prisma (`@prisma/client`, `@prisma/adapter-pg`) | 7.10.0         |
| Rate limiting     | `express-rate-limit`                            | 8.7.0          |
| Testing           | Jest + `ts-jest` + `supertest`                  | 30.5.1 / 29.4.12 / 7.2.2 |
| Dev tooling       | `tsx` (dev server + seed runner)                | 4.23.13        |
| Consumer client   | Plain HTML + vanilla JavaScript (`fetch`)       | — (no framework) |

Notes on the actual implementation:
- The Prisma client is the new **rust-free generated client** (generator
  `prisma-client`, output to `src/generated/prisma/`), driven by the
  `PrismaPg` driver adapter for PostgreSQL. The app builds the client from the
  configured `DATABASE_URL` rather than letting Prisma read the environment
  directly (`src/db.ts`).
- `package.json` version 0.1.0. Full dependency list:
  - Production: `@prisma/adapter-pg`, `@prisma/client`, `express`,
    `express-rate-limit`.
  - Dev: `@types/express`, `@types/jest`, `@types/node`, `@types/supertest`,
    `jest`, `jest`/`ts-jest`, `prisma`, `supertest`, `tsx`, `typescript`.

---

## 3. Project Structure

```
.
├── src/                        # Server source
│   ├── index.ts                # Bootstrap: loads config, starts Express
│   ├── app.ts                  # App assembly: JSON parsing, rate limiter,
│   │                           #   /v1 mounting, 404 + JSON error handlers
│   ├── config/index.ts         # Env-driven config (port, DATABASE_URL, rate limit)
│   ├── db.ts                   # Prisma client factory (PrismaPg adapter)
│   ├── routes/v1.ts            # Aggregates all resource routers under /v1
│   ├── middleware/rateLimiter.ts
│   ├── modules/
│   │   ├── airlines/           # routes.ts, handler.ts, validation.ts, data.ts
│   │   ├── flights/            # routes.ts, handler.ts, validation.ts, data.ts
│   │   ├── customers/          # routes.ts, handler.ts, validation.ts, data.ts
│   │   └── bookings/           # routes.ts, handler.ts, validation.ts, data.ts
│   ├── shared/
│   │   ├── envelope.ts         # successEnvelope / errorEnvelope shapes
│   │   ├── query.ts            # limit/offset/filter/sort parsing + validation
│   │   ├── validation.ts       # UUID helpers
│   │   └── prismaClient.ts     # Cached Prisma client per database URL
│   └── generated/prisma/       # Generated Prisma client (git-ignored;
│                               #   regenerated by `npm run prisma:generate`)
├── prisma/
│   ├── schema.prisma           # Data model (PostgreSQL)
│   └── seed/seed.ts            # Idempotent seed script (source of truth for data)
├── tests/                      # Jest suites (isolated test PostgreSQL cluster)
│   ├── integration/app.test.ts
│   ├── modules/{airlines,flights,customers,bookings}/*.test.ts
│   ├── seeding/seeding.test.ts
│   ├── helpers/testDb.ts       # Test DB URL derivation + reset
│   └── setup/                  # global-setup/teardown (spins up PostgreSQL)
├── client/                     # Minimal external consumer (HTML + JS, HTTP only)
│   ├── index.html
│   └── app.js
├── docs/
│   └── api.md                  # Locked API contract decisions
├── .agents/
│   └── rules/                  # Governing rule files (+ skills subfolder)
├── prisma.config.ts            # Prisma CLI config (schema, datasource URL)
├── jest.config.js
├── tsconfig.json               # App build config (src → dist)
├── tsconfig.test.json          # Test config
├── package.json
└── .env.example                # Environment variable reference (no secrets)
```

Explanation of the important directories:

- **`src/modules/<resource>/`** — each of the four resources is a self-contained
  module with four files, mirroring the project's required layer separation:
  - `*.routes.ts` — HTTP route definitions only.
  - `*.handler.ts` — request handling: validation call, envelope shaping,
    status codes, business flow.
  - `*.validation.ts` — request-body validation plus the resource's allowed
    list filter/sort fields.
  - `*.data.ts` — data access (Prisma queries); never formats responses.
- **`src/shared/`** — cross-resource helpers: response envelopes, list-query
  parsing (pagination/filter/sort), UUID validation, cached Prisma clients.
- **`src/middleware/`** — the rate limiter (applied globally, before routing).
- **`prisma/seed/seed.ts`** — the idempotent seed script.
- **`tests/`** — all test code, mirroring the module boundaries.
- **`client/`** — the minimal external consumer, physically separated from the
  API; it only calls the API over HTTP.
- **`.agents/rules/`** — project governance rules; `.agents/rules/skills/`
  holds the engineering skills that define the endpoint/list/filter/seeding
  procedures.

---

## 4. Data Model

All identifiers are generated, non-sequential UUIDs (never sequential
integers). API payloads use **camelCase** field names (the database columns are
snake_case; see mapping notes below).

### Airline

| Field   | Type   | Required | Notes                                    |
| ------- | ------ | -------- | ---------------------------------------- |
| `id`    | UUID   | yes (generated) | Primary identifier.                |
| `name`  | string | yes      |                                          |
| `code`  | string | yes      | IATA/ICAO-style code (e.g., `SL`).       |
| `country` | string | yes    | Country of origin.                       |

### Flight

| Field            | Type       | Required | Notes                                   |
| ---------------- | ---------- | -------- | --------------------------------------- |
| `id`             | UUID       | yes (generated) | Primary identifier.              |
| `airlineId`      | UUID       | yes      | References an existing Airline.         |
| `flightNumber`   | string     | yes      |                                         |
| `origin`         | string     | yes      |                                         |
| `destination`    | string     | yes      |                                         |
| `departureTime`  | ISO-8601   | yes      | UTC datetime.                           |
| `arrivalTime`    | ISO-8601   | yes      | UTC datetime.                           |
| `price`          | number     | yes      | Positive finite number.                 |
| `seatCapacity`   | integer    | yes      | Positive integer. **Informational only** — not enforced at booking time. |

### Customer

| Field         | Type   | Required | Notes                              |
| ------------- | ------ | -------- | ---------------------------------- |
| `id`          | UUID   | yes (generated) | Primary identifier.         |
| `fullName`    | string | yes      |                                    |
| `email`       | string | yes      |                                    |
| `phoneNumber` | string | optional | Returned as null when not set.     |

### Booking

| Field              | Type     | Required | Notes                                    |
| ------------------ | -------- | -------- | ---------------------------------------- |
| `id`               | UUID     | yes (generated) | Primary identifier.               |
| `customerId`       | UUID     | yes      | References an existing Customer.         |
| `flightId`         | UUID     | yes      | References an existing Flight.           |
| `bookingTimestamp` | ISO-8601 | yes      | UTC datetime.                            |
| `seatsBooked`      | integer  | optional | Defaults to `1`. Positive integer.       |

Bookings have **no status field**. A booking's existence is its only state.

### Relationships

```
Airline 1 ────< Flight >──── 1 ... (many customers can book one flight)
Customer 1 ────< Booking >─── 1 Flight
```

- **Airline → Flights:** one airline operates many flights; each flight belongs
  to exactly one airline (`flight.airlineId`).
- **Customer → Bookings:** one customer can make many bookings; each booking
  belongs to exactly one customer (`booking.customerId`).
- **Flight → Bookings:** one flight can be booked by many customers; each
  booking references exactly one flight (`booking.flightId`).
- **Customer ↔ Flight:** no direct relationship. They are connected indirectly
  through **Booking**, which is the join resource resolving the otherwise
  many-to-many relationship between Customers and Flights.

### Deletion behavior

- Deleting an **Airline** with Flights is **rejected** (`409 Conflict`) — never
  cascaded, never silently orphaned.
- Deleting a **Flight** with Bookings, or a **Customer** with Bookings, is
  likewise **rejected** (`409 Conflict`).
- Deleting a **Booking** is **always allowed** and represents cancellation.

---

## 5. API Base URL and Versioning

All API endpoints are served under the versioned prefix **`/v1/`**. The `/v1/`
namespace is a stable contract — non-additive changes (renaming/removing a
field) must not break it.

- Development example (local only): `http://127.0.0.1:3000/v1`
  (the server listens on `PORT`, default `3000`).
- Production: **`<to be added after deployment>`** — the API is not deployed
  yet; no production URL exists.

---

## 6. Response Format

### Success envelope

Every successful response has the same top-level shape:

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "offset": 0,
    "total": 0,
    "hasMore": false
  }
}
```

- `data` — the payload. An array (list endpoints), a single object (create/get/
  update), or `null` (delete).
- `meta` — metadata about the response. Non-list endpoints return `meta: {}`.
  List endpoints return:
  - `limit` — the page size applied (default 20, max 100).
  - `offset` — the zero-based offset applied.
  - `total` — the number of records matching the current filter, ignoring
    pagination.
  - `hasMore` — `true` when more records exist beyond the current page.

### Error envelope

Every error response uses the same shape across every endpoint:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Field \"name\" is required and must be a non-empty string"
  }
}
```

- `error.code` — a stable machine-readable code (`BAD_REQUEST`, `NOT_FOUND`,
  `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`).
- `error.message` — a human-readable description.

HTTP status codes the implementation actually returns: `400`, `404`, `409`,
`429`, and `500` (the last only for genuinely unexpected failures — never for
bad input). `422` is not returned by the current implementation: request-body
and query validation errors use `400`, and rejected dependent deletes use
`409`.

---

## 7. Endpoint Documentation

Legend for body fields: **(required)** / *(optional)*. Times are ISO-8601 UTC
strings. All IDs are UUIDs.

### Airlines

#### `GET /v1/airlines` — list airlines

- Query parameters: `limit`, `offset`, `sort`, `order`, and filters `name`
  (contains, case-insensitive), `code` (exact), `country` (exact).
- Default sort: `name` ascending.
- Status codes: `200`; `400` on invalid pagination/filter/sort.

```bash
curl "http://127.0.0.1:3000/v1/airlines?limit=20&offset=0&sort=name&order=asc"
```

```json
{
  "data": [
    { "id": "<airline-uuid>", "name": "Alpine Air", "code": "AA", "country": "Switzerland" }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 3, "hasMore": false }
}
```

#### `POST /v1/airlines` — create an airline

- Body: `name` **(required)**, `code` **(required)**, `country` **(required)**.
- Status codes: `201` on success; `400` if a required field is missing or
  malformed.

```bash
curl -X POST "http://127.0.0.1:3000/v1/airlines" \
  -H "Content-Type: application/json" \
  -d '{"name":"Northern Skies","code":"NS","country":"Canada"}'
```

```json
{
  "data": { "id": "<airline-uuid>", "name": "Northern Skies", "code": "NS", "country": "Canada" },
  "meta": {}
}
```

#### `GET /v1/airlines/:id` — get an airline by ID

- Path parameter: `id` (UUID).
- Status codes: `200`; `400` if the ID is not a valid UUID; `404` if not found.

```bash
curl "http://127.0.0.1:3000/v1/airlines/<airline-uuid>"
```

```json
{
  "data": { "id": "<airline-uuid>", "name": "Skyline Airways", "code": "SL", "country": "United Kingdom" },
  "meta": {}
}
```

#### `PATCH /v1/airlines/:id` — update an airline

- Path parameter: `id` (UUID).
- Body: at least one of `name` / `code` / `country`.
- Status codes: `200`; `400` (bad UUID, empty body, unexpected or empty field);
  `404` if not found.

```bash
curl -X PATCH "http://127.0.0.1:3000/v1/airlines/<airline-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed Airlines"}'
```

```json
{
  "data": { "id": "<airline-uuid>", "name": "Renamed Airlines", "code": "SL", "country": "United Kingdom" },
  "meta": {}
}
```

#### `DELETE /v1/airlines/:id` — delete an airline

- Path parameter: `id` (UUID).
- Status codes: `200` (returns `{"data":null,"meta":{}}`); `400` (bad UUID);
  `404` if not found; **`409`** if the airline still has flights
  (`error.code` = `CONFLICT`) — the delete is rejected and nothing is removed.

```bash
curl -X DELETE "http://127.0.0.1:3000/v1/airlines/<airline-uuid>"
```

```json
{
  "data": null,
  "meta": {}
}
```

#### `GET /v1/airlines/:id/flights` — list an airline's flights

- Path parameter: `id` (UUID).
- Accepts the Flight list-query parameters (`limit`, `offset`, `sort`, `order`,
  `origin`, `destination`, `date`) in addition to the relationship constraint.
- Status codes: `200`; `400` (bad UUID or invalid query params); `404` if the
  airline does not exist.

```bash
curl "http://127.0.0.1:3000/v1/airlines/<airline-uuid>/flights?origin=London%20Heathrow"
```

```json
{
  "data": [
    { "id": "<flight-uuid>", "airlineId": "<airline-uuid>", "flightNumber": "SL101", "origin": "London Heathrow", "destination": "Paris CDG", "departureTime": "2026-10-01T08:00:00.000Z", "arrivalTime": "2026-10-01T10:30:00.000Z", "price": 250, "seatCapacity": 180 }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

### Flights

#### `GET /v1/flights` — list flights

- Query parameters: `limit`, `offset`, `sort`, `order`, and filters `origin`
  (exact), `destination` (exact), `date` (YYYY-MM-DD, matches the flight's
  departure calendar day in UTC).
- Default sort: `departureTime` ascending.
- Status codes: `200`; `400` on invalid pagination/filter/sort.

```bash
curl "http://127.0.0.1:3000/v1/flights?origin=Zurich&destination=Munich"
```

```json
{
  "data": [
    { "id": "<flight-uuid>", "airlineId": "<airline-uuid>", "flightNumber": "AA102", "origin": "Zurich", "destination": "Munich", "departureTime": "2026-10-02T07:00:00.000Z", "arrivalTime": "2026-10-02T07:45:00.000Z", "price": 120, "seatCapacity": 140 }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

#### `POST /v1/flights` — create a flight

- Body:
  - `airlineId` **(required, UUID)** — must reference an existing Airline.
  - `flightNumber` **(required)**.
  - `origin` **(required)**, `destination` **(required)**.
  - `departureTime` **(required, ISO-8601)**, `arrivalTime` **(required,
    ISO-8601)**.
  - `price` **(required, positive finite number)**.
  - `seatCapacity` **(required, positive integer)**.
- Status codes: `201`; `400` (missing/malformed fields, non-UUID `airlineId`,
  invalid datetime, non-finite price); `404` if the referenced airline does not
  exist.

```bash
curl -X POST "http://127.0.0.1:3000/v1/flights" \
  -H "Content-Type: application/json" \
  -d '{
    "airlineId": "<airline-uuid>",
    "flightNumber": "SL104",
    "origin": "London Heathrow",
    "destination": "Berlin",
    "departureTime": "2026-10-04T08:00:00.000Z",
    "arrivalTime": "2026-10-04T11:00:00.000Z",
    "price": 290,
    "seatCapacity": 180
  }'
```

```json
{
  "data": {
    "id": "<flight-uuid>",
    "airlineId": "<airline-uuid>",
    "flightNumber": "SL104",
    "origin": "London Heathrow",
    "destination": "Berlin",
    "departureTime": "2026-10-04T08:00:00.000Z",
    "arrivalTime": "2026-10-04T11:00:00.000Z",
    "price": 290,
    "seatCapacity": 180
  },
  "meta": {}
}
```

#### `GET /v1/flights/:id` — get a flight by ID

- Status codes: `200`; `400` (bad UUID); `404` if not found.

```bash
curl "http://127.0.0.1:3000/v1/flights/<flight-uuid>"
```

```json
{
  "data": { "id": "<flight-uuid>", "airlineId": "<airline-uuid>", "flightNumber": "PW102", "origin": "Los Angeles", "destination": "New York JFK", "departureTime": "2026-10-01T13:00:00.000Z", "arrivalTime": "2026-10-01T21:00:00.000Z", "price": 450, "seatCapacity": 200 },
  "meta": {}
}
```

#### `PATCH /v1/flights/:id` — update a flight

- Body: any of `airlineId`, `flightNumber`, `origin`, `destination`,
  `departureTime`, `arrivalTime`, `price`, `seatCapacity` (at least one).
- Status codes: `200`; `400` (bad UUID, empty body, unexpected/empty field);
  `404` if the flight or the new airline does not exist.

```bash
curl -X PATCH "http://127.0.0.1:3000/v1/flights/<flight-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"origin":"Zulu","price":260}'
```

```json
{
  "data": { "id": "<flight-uuid>", "airlineId": "<airline-uuid>", "flightNumber": "SL101", "origin": "Zulu", "destination": "Paris CDG", "departureTime": "2026-10-01T08:00:00.000Z", "arrivalTime": "2026-10-01T10:30:00.000Z", "price": 260, "seatCapacity": 180 },
  "meta": {}
}
```

#### `DELETE /v1/flights/:id` — delete a flight

- Status codes: `200` (`data: null`); `400` (bad UUID); `404` if not found;
  **`409`** if the flight still has bookings.

```bash
curl -X DELETE "http://127.0.0.1:3000/v1/flights/<flight-uuid>"
```

```json
{
  "data": null,
  "meta": {}
}
```

#### `GET /v1/flights/:id/bookings` — list a flight's bookings

- Accepts the Booking list-query parameters (`limit`, `offset`, `sort`, `order`,
  `customerId`, `flightId`) in addition to the relationship constraint.
- Status codes: `200`; `400` (bad UUID or invalid query params); `404` if the
  flight does not exist.

```bash
curl "http://127.0.0.1:3000/v1/flights/<flight-uuid>/bookings"
```

```json
{
  "data": [
    { "id": "<booking-uuid>", "customerId": "<customer-uuid>", "flightId": "<flight-uuid>", "bookingTimestamp": "2026-09-10T10:00:00.000Z", "seatsBooked": 2 }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

### Customers

#### `GET /v1/customers` — list customers

- Query parameters: `limit`, `offset`, `sort`, `order`, and filters `fullName`
  (contains, case-insensitive), `email` (contains, case-insensitive).
- Default sort: `fullName` ascending.

```bash
curl "http://127.0.0.1:3000/v1/customers?email=lovelace"
```

```json
{
  "data": [
    { "id": "<customer-uuid>", "fullName": "Ada Lovelace", "email": "ada.lovelace@example.com", "phoneNumber": null }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

#### `POST /v1/customers` — create a customer

- Body: `fullName` **(required)**, `email` **(required)**, `phoneNumber`
  *(optional)*.
- Status codes: `201`; `400` on missing/malformed fields.

```bash
curl -X POST "http://127.0.0.1:3000/v1/customers" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Ada Lovelace","email":"ada.lovelace@example.com"}'
```

```json
{
  "data": { "id": "<customer-uuid>", "fullName": "Ada Lovelace", "email": "ada.lovelace@example.com", "phoneNumber": null },
  "meta": {}
}
```

#### `GET /v1/customers/:id` — get a customer by ID

- Status codes: `200`; `400` (bad UUID); `404` if not found.

```bash
curl "http://127.0.0.1:3000/v1/customers/<customer-uuid>"
```

```json
{
  "data": { "id": "<customer-uuid>", "fullName": "Grace Hopper", "email": "grace.hopper@example.com", "phoneNumber": null },
  "meta": {}
}
```

#### `PATCH /v1/customers/:id` — update a customer

- Body: any of `fullName`, `email`, `phoneNumber` (at least one).
- Status codes: `200`; `400` (bad UUID, empty body, unexpected/empty field);
  `404` if not found.

```bash
curl -X PATCH "http://127.0.0.1:3000/v1/customers/<customer-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1-555-0100"}'
```

```json
{
  "data": { "id": "<customer-uuid>", "fullName": "Ada Lovelace", "email": "ada.lovelace@example.com", "phoneNumber": "+1-555-0100" },
  "meta": {}
}
```

#### `DELETE /v1/customers/:id` — delete a customer

- Status codes: `200` (`data: null`); `400` (bad UUID); `404` if not found;
  **`409`** if the customer still has bookings.

```bash
curl -X DELETE "http://127.0.0.1:3000/v1/customers/<customer-uuid>"
```

```json
{
  "data": null,
  "meta": {}
}
```

#### `GET /v1/customers/:id/bookings` — list a customer's bookings

- Accepts the Booking list-query parameters (`limit`, `offset`, `sort`, `order`,
  `customerId`, `flightId`).
- Status codes: `200`; `400`; `404` if the customer does not exist.

```bash
curl "http://127.0.0.1:3000/v1/customers/<customer-uuid>/bookings?sort=bookingTimestamp&order=desc"
```

```json
{
  "data": [
    { "id": "<booking-uuid>", "customerId": "<customer-uuid>", "flightId": "<flight-uuid>", "bookingTimestamp": "2026-09-12T09:00:00.000Z", "seatsBooked": 3 }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

### Bookings

**Bookings do not support update.** There is no `PATCH`/`PUT` route — the only
mutating operations are **create** and **delete**. A booking's existence is its
only state; deleting it represents cancellation.

#### `GET /v1/bookings` — list bookings

- Query parameters: `limit`, `offset`, `sort`, `order`, and filters `customerId`
  (UUID), `flightId` (UUID).
- Default sort: `bookingTimestamp` **descending**.

```bash
curl "http://127.0.0.1:3000/v1/bookings?flightId=<flight-uuid>"
```

```json
{
  "data": [
    { "id": "<booking-uuid>", "customerId": "<customer-uuid>", "flightId": "<flight-uuid>", "bookingTimestamp": "2026-09-18T13:00:00.000Z", "seatsBooked": 1 }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

#### `POST /v1/bookings` — create a booking

- Body:
  - `customerId` **(required, UUID)** — must reference an existing Customer.
  - `flightId` **(required, UUID)** — must reference an existing Flight.
  - `bookingTimestamp` **(required, ISO-8601)**.
  - `seatsBooked` *(optional, positive integer)* — defaults to `1`.
- **No capacity validation:** creation does not validate against the flight's
  remaining seats; `seat_capacity` is informational only and overbooking is not
  prevented.
- Status codes: `201`; `400` (missing/malformed fields, non-UUID reference,
  invalid timestamp); `404` if the referenced customer or flight does not exist.

```bash
curl -X POST "http://127.0.0.1:3000/v1/bookings" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"<customer-uuid>","flightId":"<flight-uuid>","bookingTimestamp":"2026-09-19T09:00:00.000Z","seatsBooked":1}'
```

```json
{
  "data": {
    "id": "<booking-uuid>",
    "customerId": "<customer-uuid>",
    "flightId": "<flight-uuid>",
    "bookingTimestamp": "2026-09-19T09:00:00.000Z",
    "seatsBooked": 1
  },
  "meta": {}
}
```

#### `GET /v1/bookings/:id` — get a booking by ID

- Status codes: `200`; `400` (bad UUID); `404` if not found.

#### `DELETE /v1/bookings/:id` — delete (cancel) a booking

- **Always allowed.** No dependent-record check applies to Bookings.
- Status codes: `200` (`data: null`); `400` (bad UUID); `404` if not found.

```bash
curl -X DELETE "http://127.0.0.1:3000/v1/bookings/<booking-uuid>"
```

```json
{
  "data": null,
  "meta": {}
}
```

---

## 8. Pagination, Filtering and Sorting

The implementation uses **offset-based pagination** (`limit` + `offset`),
applied identically to **every** list endpoint (primary resource lists and
relationship-scoped lists). Cursor pagination is not implemented.

### Pagination contract

| Parameter | Type | Default | Rules |
| --------- | ---- | ------- | ----- |
| `limit`   | int  | `20`    | 1–100. Out of range or non-integer (e.g., `0`, `101`, `abc`, `-5`) → `400`. |
| `offset`  | int  | `0`     | Non-negative integer only; otherwise (e.g., `-1`, `abc`) → `400`. |

`meta.total` is the count of records matching the current filter (ignoring
pagination); `meta.hasMore` is `true` when more records exist beyond the
current page (`offset + rows.length < total`).

```bash
curl "http://127.0.0.1:3000/v1/airlines?limit=2&offset=0"
```

```json
{
  "data": [ { "id": "<uuid>", "name": "Alpine Air", "code": "AA", "country": "Switzerland" } ],
  "meta": { "limit": 2, "offset": 0, "total": 3, "hasMore": true }
}
```

### Filtering contract

| Resource list  | Filter fields (mode)             |
| -------------- | -------------------------------- |
| Airlines       | `name` (contains), `code` (exact), `country` (exact) |
| Flights        | `origin` (exact), `destination` (exact), `date` (YYYY-MM-DD, matches departure day UTC) |
| Customers      | `fullName` (contains), `email` (contains) |
| Bookings       | `customerId` (UUID), `flightId` (UUID) |

- `contains` = case-insensitive substring match. `exact` = equality match.
- Any unknown query parameter, unsupported filter, or invalid filter value →
  `400`.
- Relationship-scoped lists (flights of an airline, bookings of a flight or
  customer) accept the **child** resource's filter/sort fields in addition to
  the relationship constraint, and still require the parent to exist.

### Sorting contract

- `sort` — one of the resource's sortable fields (camelCase).
- `order` — `asc` or `desc`; providing `order` without `sort` → `400`.
- Unknown `sort` field or invalid `order` → `400`.
- Default ordering (no `sort`): airlines `name` asc, flights `departureTime`
  asc, customers `fullName` asc, bookings `bookingTimestamp` desc. A `id`
  tiebreak keeps offset pagination deterministic.

| Resource list  | Sortable fields |
| -------------- | --------------- |
| Airlines       | `name`, `code`, `country`, `id` |
| Flights        | `flightNumber`, `origin`, `destination`, `departureTime`, `arrivalTime`, `price`, `id` |
| Customers      | `fullName`, `email`, `id` |
| Bookings       | `customerId`, `flightId`, `bookingTimestamp`, `seatsBooked`, `id` |

### Invalid pagination/filter/sort example

```bash
curl -i "http://127.0.0.1:3000/v1/flights?sort=gate&order=asc"
```

```json
HTTP/1.1 400 Bad Request

{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Unsupported sort field \"gate\""
  }
}
```

---

## 9. Validation and Error Handling

Input validation happens at the service boundary (in handlers/validation
modules) before any business logic or data access runs. A malformed ID or
invalid query parameter is always handled as a client error, never a `500`.

### Status code mapping actually implemented

| Status | Meaning | `error.code` | Examples |
| ------ | ------- | ------------ | -------- |
| `400`  | Malformed request / invalid input | `BAD_REQUEST` | Malformed JSON, missing required field, bad UUID, `limit=0`, `limit=101`, `offset=-1`, unknown filter, unknown/`sort`, bad `order`, `order` without `sort`, invalid `date`, non-finite `price`. |
| `404`  | Well-formed reference to a nonexistent resource or route | `NOT_FOUND` | Unknown route, get/update/delete of a nonexistent record, relationship list against a nonexistent parent, create referencing a nonexistent airline/customer/flight. |
| `409`  | Delete rejected because dependent records exist | `CONFLICT` | Deleting an Airline with Flights; a Flight or Customer with Bookings. Never cascades. |
| `429`  | Rate limit exceeded | `RATE_LIMITED` | Any request beyond the configured limit. Includes `Retry-After` header. |
| `500`  | Unexpected failure | `INTERNAL_ERROR` | Only genuine unexpected errors — never bad input. |

**Note on `422`:** the project rule file `data-integrity.md` reserves `422` for
"a well-formed request that fails validation or a business rule," but the
current implementation does not emit `422`. Request/query validation failures
return `400`; dependent deletes return `409`. This README documents the
implementation as it is.

### Example: missing required field

```bash
curl -i -X POST "http://127.0.0.1:3000/v1/customers" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"No Email"}'
```

```json
HTTP/1.1 400 Bad Request

{
  "error": { "code": "BAD_REQUEST", "message": "Field \"email\" is required and must be a non-empty string" }
}
```

### Example: malformed (non-UUID) ID

```bash
curl -i "http://127.0.0.1:3000/v1/airlines/not-a-uuid"
```

```json
HTTP/1.1 400 Bad Request

{
  "error": { "code": "BAD_REQUEST", "message": "Airline ID must be a valid UUID" }
}
```

### Example: nonexistent referenced resource (creation)

```bash
curl -i -X POST "http://127.0.0.1:3000/v1/bookings" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"00000000-0000-0000-0000-000000000000","flightId":"00000000-0000-0000-0000-000000000000","bookingTimestamp":"2026-09-19T09:00:00.000Z"}'
```

```json
HTTP/1.1 404 Not Found

{
  "error": { "code": "NOT_FOUND", "message": "Customer not found" }
}
```

### Example: dependent deletion rejected

```bash
curl -i -X DELETE "http://127.0.0.1:3000/v1/airlines/<airline-uuid-with-flights>"
```

```json
HTTP/1.1 409 Conflict

{
  "error": { "code": "CONFLICT", "message": "Cannot delete airline: dependent flights exist" }
}
```

### Example: malformed JSON

```bash
curl -i -X POST "http://127.0.0.1:3000/v1/airlines" \
  -H "Content-Type: application/json" \
  -d '{ this is not json'
```

```json
HTTP/1.1 400 Bad Request

{
  "error": { "code": "BAD_REQUEST", "message": "Malformed JSON in request body" }
}
```

---

## 10. Rate Limiting

Rate limiting is applied **globally to every request** before routing
(`src/app-factory.ts` → `src/middleware/rateLimiter.ts`), using `express-rate-limit`
keyed by the requester's IP address (its default key generator). It is **not**
scoped per API key or per authenticated client, and no client-identification or
API-key-issuance system exists.

| Setting              | Default | Environment variable        |
| -------------------- | ------- | --------------------------- |
| Window               | 60000 ms (1 minute) | `RATE_LIMIT_WINDOW_MS` |
| Maximum requests/window | 100  | `RATE_LIMIT_MAX`            |

Configuration lives in environment variables (see `.env.example`); the values
are read by `src/config/index.ts` and injected into the app. They must not be
hard-coded in request handlers.

When the limit is exceeded, the API returns:

- **`429 Too Many Requests`** with the consistent error envelope
  `{ "error": { "code": "RATE_LIMITED", "message": "Too many requests, please try again later" } }`.
- A **`Retry-After`** header indicating when the client may retry.

```bash
curl -i "http://127.0.0.1:3000/v1/airlines"   # repeat past the limit
```

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 37

{
  "error": { "code": "RATE_LIMITED", "message": "Too many requests, please try again later" }
}
```

(The exact `Retry-After` value is the number of seconds remaining in the
window at the time of the request.)

---

## 11. Seed Data

### How to run the seed

```bash
npm run db:seed
```

The seed runner reads `DATABASE_URL` from `.env` (or the environment) and calls
`runSeed()` from `prisma/seed/seed.ts`.

### Idempotency

The seed is **repeatable and idempotent**: running it any number of times
produces the same dataset with **zero duplicate records**. Each resource is
deduplicated by a stable natural key (never the public UUID):

| Resource  | Natural key used for dedup       |
| --------- | -------------------------------- |
| Airline   | `code`                           |
| Customer  | `email`                          |
| Flight    | `flightNumber` + departure time  |
| Booking   | customer email + flight key      |

On a second run, records that already exist are skipped — the script reports
`created: { airlines: 0, customers: 0, flights: 0, bookings: 0 }`. Seeding order
follows the foreign-key graph: Airlines → Customers → Flights → Bookings.

### Current development seed totals

| Resource  | Count |
| --------- | ----- |
| Airlines  | 300   |
| Customers | 400   |
| Flights   | 500   |
| Bookings  | 600   |

A small hand-written base dataset (the original 3 airlines, 4 customers,
8 flights, and 12 bookings) is preserved, then expanded deterministically by
`prisma/seed/seed.ts` to the totals above. Expansion is pure and index-driven,
so the generated dataset is identical on every run; generated records reuse the
same stable natural keys as the base rows, so re-runs stay idempotent.

### Seed volume vs. Task 1 requirement

**Requirement met.** Task 1 of the original engineering brief requires "a few
hundred records per resource" in the seed data. The seed now creates 300
airlines, 400 customers, 500 flights, and 600 bookings — a few hundred per
resource — while remaining idempotent, preserving valid foreign keys, and
assigning generated UUIDs. Running `npm run db:seed` a second time reports
`created: { airlines: 0, customers: 0, flights: 0, bookings: 0 }`.

---

## 12. Consumer Client

- **Location:** `client/` (`index.html` + `app.js`), physically separated from
  the API codebase. It consumes the API only over HTTP via `fetch` and never
  imports API internals or touches the database.
- **APIs it calls:**
  - `GET /v1/flights` and `GET /v1/customers` — baseline read capability to
    populate dropdowns and display flight data.
  - `POST /v1/bookings` — the one success path.
- **Data it displays:** a list of flights (ID, flight number, origin →
  destination, price, capacity) and a customer dropdown; the booking result
  (booking ID, customer, flight, seats) is shown after submission.
- **One success path:** create a Booking referencing an existing Customer and
  Flight; on success it renders the created booking.
- **One failure path:** attempt a Booking with invalid input; the client
  renders the API's error (`error.code` + `error.message`). It does not expand
  into a fuller booking experience.
- **Base URL configuration:** a single swap point in `client/app.js` —
  `PRODUCTION_API_BASE_URL`. It is currently the placeholder
  `https://REPLACE_WITH_DEPLOYED_PUBLIC_API_URL/v1`. A development-only
  override (`?apiBaseUrl=http://127.0.0.1:3000/v1` in the page URL) allows local
  verification against a local instance; the committed default remains the
  public placeholder.
- **Deployment status:** the client is **not** pointed at a live public API yet
  — it still targets a placeholder and a local override. It must be switched to
  the real public URL after deployment.

---

## 13. Running Locally

The following commands are the ones defined in `package.json` and required by
the repository. Run them from the repository root.

### Prerequisites

- Node.js `>= 24`.
- A running PostgreSQL server (for the app itself). Tests additionally require
  local PostgreSQL binaries at `C:\Program Files\PostgreSQL\{18,17}\bin`
  (`initdb.exe`, `pg_ctl.exe`) so they can spin up an isolated test cluster on
  port `55432`.

### 1. Install dependencies

```bash
npm install
```

### 2. Environment configuration

```bash
copy .env.example .env
```

Then edit `.env` and set `DATABASE_URL` to your PostgreSQL connection string:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/flight_booking_api
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

Never commit `.env` (it is git-ignored).

### 3. Generate the Prisma client

```bash
npm run prisma:generate
```

### 4. Create the database schema

No migration files are committed yet, so a fresh database is set up by pushing
the schema (the same approach the test harness uses):

```bash
npx prisma db push
```

(`npm run prisma:migrate` is available if you prefer to create migration files,
and `npm run prisma:validate` validates the schema.)

### 5. Seed the database

```bash
npm run db:seed
```

### 6. Start the development server

```bash
npm run dev
```

The server listens on `PORT` (default `3000`) and logs
`Flight Booking API listening on port 3000`. For a production-style start after
building: `npm run build` then `npm start`.

### 7. Typecheck

```bash
npm run typecheck
```

### 8. Build

```bash
npm run build
```

Output goes to `dist/`.

### 9. Run tests

```bash
npm test -- --runInBand
```

(The suite is configured with `maxWorkers: 1`; passing `--runInBand` runs Jest
single-threaded as the verified invocation.)

---

## 14. API Usage Examples

All examples target the development server (`http://127.0.0.1:3000/v1`).
`<airline-uuid>`, `<flight-uuid>`, etc. are placeholders — replace them with
real IDs (list an endpoint first to obtain them; the seeded data contains 300
airlines, 500 flights, 400 customers, and 600 bookings).

### List airlines

```bash
curl "http://127.0.0.1:3000/v1/airlines"
```

### List flights

```bash
curl "http://127.0.0.1:3000/v1/flights"
```

### Filter flights

```bash
curl "http://127.0.0.1:3000/v1/flights?origin=Zurich&destination=Munich"
curl "http://127.0.0.1:3000/v1/flights?date=2026-10-01"
curl "http://127.0.0.1:3000/v1/flights?sort=price&order=asc&limit=100"
```

### Create a customer

```bash
curl -X POST "http://127.0.0.1:3000/v1/customers" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Marie Curie","email":"marie.curie@example.com","phoneNumber":"+33-1-00-00-00"}'
```

### Create a booking

```bash
curl -X POST "http://127.0.0.1:3000/v1/bookings" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"<customer-uuid>","flightId":"<flight-uuid>","bookingTimestamp":"2026-09-19T09:00:00.000Z","seatsBooked":2}'
```

### Get a booking

```bash
curl "http://127.0.0.1:3000/v1/bookings/<booking-uuid>"
```

### Delete a booking

```bash
curl -X DELETE "http://127.0.0.1:3000/v1/bookings/<booking-uuid>"
```

### An invalid request

```bash
curl -X POST "http://127.0.0.1:3000/v1/flights" \
  -H "Content-Type: application/json" \
  -d '{"airlineId":"<airline-uuid>","flightNumber":"X1"}'
# → 400 BAD_REQUEST: Field "origin" is required and must be a non-empty string
```

### A nonexistent resource request

```bash
curl -i "http://127.0.0.1:3000/v1/airlines/00000000-0000-0000-0000-000000000000"
# → 404 NOT_FOUND: Airline not found
```

---

## Design decisions

**Why these resources?** Airlines, Flights, Customers, and Bookings were
selected because they model a small but complete relational web: Airlines own
Flights, Customers own Bookings, and Booking is the join record connecting
Customers to Flights. That is enough domain structure to demonstrate
one-to-many and many-to-many-via-join relationships without dragging in
commercial airline complexity. The PRD (§3) fixes exactly these four resources.

**Why generated identifiers?** All resources use generated, non-sequential
UUIDs rather than sequential integers. This avoids leaking dataset size and
growth order, prevents guessing/iteration over another party's records, and is
a locked PRD requirement (§2, §3; `identity-and-contract.md`). IDs are produced
with `crypto.randomUUID()` at the handler layer (with `@default(uuid())` also
declared in the schema) and are never derived from the natural keys used for
seed deduplication.

**Pagination choice.** The implementation uses **offset-based pagination**
(`limit` + `offset`), not cursor pagination. Offset pagination was chosen
because it is simple, deterministic (a stable `id` tiebreak is applied to every
list), and can be applied identically across all four resources' list
endpoints, which is exactly what the project contract requires
(`identity-and-contract.md`). All list endpoints share the same default
(`limit` 20, `offset` 0), the same maximum (`limit` 100), and the same `meta`
shape (`limit`/`offset`/`total`/`hasMore`).

**Response envelope.** Every success response uses `data` + `meta`, and every
error response uses `{ "error": { "code", "message" } }`. A single envelope on
both paths matters because clients should parse responses uniformly regardless
of endpoint or outcome — no special-casing per resource, and no ambiguity about
where the payload (or the error) lives. The shapes are locked in
`identity-and-contract.md` and repeated identically on all 20+ endpoints.

**Booking design.** Booking is deliberately the join resource that connects a
Customer to a Flight (there is no direct Customer↔Flight table). Bookings are
immutable after creation — no update endpoint exists — so the only mutating
operations are creation and deletion, and deletion stands in for cancellation
(PRD §5 item 2, §6). A booking carries no status field; its existence is its
state.

**Capacity.** `seat_capacity` on a Flight is informational in this version.
Booking creation validates only that `customerId` and `flightId` reference
existing records; it does not check remaining seat capacity, and overbooking is
not prevented. This follows PRD §5 item 5 and §8 (no live seat-availability
decrementing), rather than imposing the rules of a real commercial booking
system.

---

## 16. Testing

- **Framework:** Jest 30.5.1 (with `ts-jest` and `supertest`), configured with
  `maxWorkers: 1`. The harness spins up an isolated PostgreSQL cluster on port
  `55432` (`tests/setup/global-setup.ts`), pushes the Prisma schema, and resets
  tables between tests.
- **Test suites (6):**
  1. `tests/integration/app.test.ts` — `/v1/` mounting, unknown routes, error
     envelope, malformed JSON, rate limiting (`429` + `Retry-After`).
  2. `tests/modules/airlines/`
  3. `tests/modules/flights/`
  4. `tests/modules/customers/`
  5. `tests/modules/bookings/`
  6. `tests/seeding/`
- **Current count: 6 suites, 98 tests — all passing** (verified with
  `npm test -- --runInBand`).
- **How to run:** `npm test -- --runInBand`.
- **Typecheck:** `npm run typecheck`.
- **Build:** `npm run build`.

Important areas covered by the tests:
- Full CRUD per resource, including create/update/delete happy paths.
- `400` for missing required fields, malformed IDs, invalid datetimes, invalid
  pagination (`limit=0`, `limit=101`, `limit=abc`, `offset=-1`, `offset=abc`),
  unknown filter fields, invalid `sort`/`order`, and non-finite prices.
- `404` for nonexistent records, nonexistent parents on relationship lists, and
  foreign-key references to nonexistent airlines/customers/flights.
- `409` for dependent deletes (no cascade) and the Booking deletion exception
  (always deletable).
- Offset pagination defaults (`limit` 20), max (`limit` 100), `total`, and
  `hasMore` on every list endpoint, including relationship-scoped lists.
- Filtering and sorting per resource, including child-resource filters on
  relationship lists.
- Booking immutability: no `PATCH`/`PUT` route, no capacity check
  (overbooking allowed), no status field.
- Idempotent seeding (second run creates zero records), UUID identifiers
  distinct from natural keys, and foreign-key integrity of seeded data.
- Rate limiting: `429` + `Retry-After` and the consistent `RATE_LIMITED` error
  envelope.

---

## 17. Deployment

Deployment is the **next stage** and has **not** been performed as part of this
work. No provider or URL has been chosen.

> ### Production API URL: Not deployed yet

Once deployment happens, the following are still required and currently
outstanding:

1. **Seed the production database** with `npm run db:seed` (using the
   production `DATABASE_URL`).
2. **Point the consumer client** (`client/app.js`) at the real public API URL
   by replacing the `PRODUCTION_API_BASE_URL` placeholder.
3. Re-verify the consumer's success and failure paths against the **live**
   API, per the PRD success criteria ("against the deployed API, not a local
   copy").

---

## 18. Project Evidence Checklist

Status notation: **Done** = verified in this repository; **Not done** = still
outstanding (must not be presented as complete until actually performed).

| Evidence item                                  | Status      | Notes |
| ---------------------------------------------- | ----------- | ----- |
| Three or more related resources                 | Done        | Airlines, Flights, Customers, Bookings (4). |
| Repeatable seed script                          | Done        | `npm run db:seed`; second run creates zero records. |
| Required realistic seed volume (a few hundred per resource) | Done | 300 airlines / 400 customers / 500 flights / 600 bookings; second `db:seed` creates zero records. |
| Versioned paths (`/v1/`)                        | Done        | Every route under `/v1`. |
| Pagination                                      | Done        | Offset-based; default 20, max 100, `total`, `hasMore`. |
| Filtering                                       | Done        | ≥2 filterable fields per resource. |
| Sorting                                         | Done        | `sort` + `order` on all list endpoints. |
| Consistent response envelopes                   | Done        | `data` + `meta` on every success response. |
| Consistent error envelopes                      | Done        | `{ error: { code, message } }` everywhere. |
| Honest status codes                             | Done        | `400` / `404` / `409` / `429` as implemented; `422` not emitted. |
| Configured rate limiting                        | Done        | Env-configurable; default 100 req/min by IP; `429` + `Retry-After`. |
| Full endpoint documentation                     | Done        | Section 7 of this README documents every implemented endpoint. |
| Curl examples                                   | Done        | Section 14 (plus per-endpoint examples). |
| Public API URL                                  | **Not done** | Placeholder only; not deployed. |
| Production seed completed                       | **Not done** | Requires deployment + `npm run db:seed` on production DB. |
| Consumer using public API                       | **Not done** | `PRODUCTION_API_BASE_URL` still a placeholder; local override only. |
| Screenshot of curl against live API             | **Not done** | Requires deployment. |
| Screenshot of `429` response                    | **Not done** | Requires a live API instance. |
| Screenshot of consumer using live API           | **Not done** | Requires deployment + consumer pointed at public URL. |

---

## Remaining gaps

The project is **not** complete until all of the following are addressed:

1. **Deployment** — deploy the API (provider/URL not yet chosen).
2. **Production seeding** — run the seed against the production database after
   deployment.
3. **Public API URL** — record the real URL and replace the placeholder in
   `client/app.js`.
4. **Live consumer verification** — confirm the consumer's success and failure
   paths against the deployed API, not a local copy.
5. **Evidence screenshots** — capture curl / `429` / consumer screenshots
   against the live API.

This README documents the system as implemented today and will not claim these
items complete until they are actually done.