# Flight Booking REST API — API documentation

## Contract foundation (locked)

- Base path: `/v1/` (identity-and-contract.md)
- Response envelope: top-level `data` + `meta` on success (identity-and-contract.md)
- Error envelope: `{ "error": { "code": "...", "message": "..." } }` — applied
  identically across every endpoint, including 429 rate-limit responses
- Field naming: camelCase for all JSON request and response fields, matching
  Prisma's generated-client convention. Prisma `snake_case` columns are mapped
  to camelCase in every API payload.
- Resource IDs: generated, non-sequential identifiers (UUIDs); never
  sequential integers (identity-and-contract.md)
- Resources: Airlines, Flights, Customers, Bookings (PRD §3)
- Status code mapping (data-integrity.md): `400` malformed request / bad UUID,
  `404` well-formed reference to a nonexistent resource, `409` delete rejected
  because dependent records exist, `422` well-formed request failing validation
  or a business rule, `429` rate limited (with `Retry-After` header)
- Rate limiting: configurable, ~100 requests/minute, by IP or globally,
  429 + `Retry-After` (rate-limiting.md)

## Decided design points (formerly open decisions — now final)

- **Error response shape:** `{ "error": { "code": "...", "message": "..." } }`
- **Field naming:** camelCase (matches Prisma generated-client convention)
- **Dependent-delete status code:** `409 Conflict` when deleting an Airline,
  Flight, or Customer that has dependent records (Flights / Bookings). Rejected
  deletes never cascade and never orphan dependents.
- **Pagination mechanism:** offset-based (`limit` + `offset`), applied
  identically to every list endpoint. Default `limit` 20, max `limit` 100,
  `meta` includes `limit`, `offset`, `total`, and `hasMore`.

## List endpoints

Every list endpoint (primary resource lists and relationship-scoped lists)
accepts the same query parameters and returns the same `meta` shape.

### Query parameters

| Parameter | Type   | Default | Notes                                         |
| --------- | ------ | ------- | --------------------------------------------- |
| `limit`   | int    | `20`    | 1–100; out of range or non-integer → `400`    |
| `offset`  | int    | `0`     | Non-negative; otherwise → `400`               |
| `sort`    | string | per-resource default | One of the resource's sortable fields (camelCase); unknown → `400` |
| `order`   | string | `asc`   | `asc` or `desc`; requires `sort`, else `400`  |
| filters   | string | —       | Each resource's filterable fields (camelCase); unknown param or invalid value → `400` |

An unsupported/unknown query parameter is rejected with `400`, never silently
ignored and never a `500` (data-integrity.md).

### Response

```json
{
  "data": [ ... ],
  "meta": { "limit": 20, "offset": 0, "total": 47, "hasMore": true }
}
```

`total` is the number of records matching the current filter (ignoring
pagination); `hasMore` is `true` when more records exist beyond the current
page. Default ordering when `sort` is absent: airlines by `name` asc,
flights by `departureTime` asc, customers by `fullName` asc, bookings by
`bookingTimestamp` desc. A default `id` tiebreak keeps offset pagination
deterministic.

### Filterable and sortable fields per resource

| Resource list   | Filter fields (mode)                     | Sortable fields |
| --------------- | ----------------------------------------- | --------------- |
| Airlines        | `name` (contains), `code` (exact), `country` (exact) | name, code, country, id |
| Flights         | `origin` (exact), `destination` (exact), `date` (YYYY-MM-DD, matches departure day) | flightNumber, origin, destination, departureTime, arrivalTime, price, id |
| Customers       | `fullName` (contains), `email` (contains) | fullName, email, id |
| Bookings        | `customerId` (UUID), `flightId` (UUID)     | customerId, flightId, bookingTimestamp, seatsBooked, id |

- `contains`: case-insensitive substring match.
- `exact`: equality match.
- `date`: the flight's departure date must fall on that calendar day (UTC).
- Relationship-scoped lists (flights by airline, bookings by customer/flight)
  accept the child resource's filter/sort fields and apply them in addition to
  the relationship constraint; they still require the parent to exist (`404`).

## Endpoints

### Airlines

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | /v1/airlines        | List airlines                                |
| POST   | /v1/airlines        | Create airline (name, code, country)         |
| GET    | /v1/airlines/:id    | Get airline by ID                            |
| PATCH  | /v1/airlines/:id    | Update airline                               |
| DELETE | /v1/airlines/:id    | Delete airline (409 if it has flights)       |
| GET    | /v1/airlines/:id/flights | List flights belonging to the airline   |

### Flights

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | /v1/flights         | List flights                                 |
| POST   | /v1/flights         | Create flight (404 if airline_id missing)    |
| GET    | /v1/flights/:id     | Get flight by ID                             |
| PATCH  | /v1/flights/:id     | Update flight                                |
| DELETE | /v1/flights/:id     | Delete flight (409 if it has bookings)       |
| GET    | /v1/flights/:id/bookings | List bookings belonging to the flight    |

### Customers

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | /v1/customers       | List customers                               |
| POST   | /v1/customers       | Create customer (fullName, email, phoneNumber?) |
| GET    | /v1/customers/:id   | Get customer by ID                           |
| PATCH  | /v1/customers/:id   | Update customer                              |
| DELETE | /v1/customers/:id   | Delete customer (409 if it has bookings)     |
| GET    | /v1/customers/:id/bookings | List bookings belonging to the customer |

### Bookings

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | /v1/bookings        | List bookings                                |
| POST   | /v1/bookings        | Create booking (404 if customer or flight missing) |
| GET    | /v1/bookings/:id    | Get booking by ID                            |
| DELETE | /v1/bookings/:id    | Delete booking (always allowed — represents cancellation) |

**Bookings have no update endpoint.** They are immutable after creation —
create and delete only. Creation does not validate against remaining seat
capacity; `seat_capacity` is informational only (PRD §5 item 5, §8).

## Payload field mapping (internal `snake_case` → API `camelCase`)

- Flight: `airline_id → airlineId`, `flight_number → flightNumber`,
  `departure_time → departureTime`, `arrival_time → arrivalTime`,
  `seat_capacity → seatCapacity`; `price` is returned as a number.
- Customer: `full_name → fullName`, `phone_number → phoneNumber`.
- Booking: `customer_id → customerId`, `flight_id → flightId`,
  `booking_timestamp → bookingTimestamp`, `seats_booked → seatsBooked`.
- Airline: unchanged (`id`, `name`, `code`, `country`).

## Error handling

Status code mapping follows data-integrity.md: `400` malformed request,
`404` well-formed reference to a nonexistent resource, `409` rejected
dependent delete, `422` well-formed request failing validation or a business
rule, `429` rate limited. Every error body uses the shape
`{ "error": { "code": "...", "message": "..." } }`.