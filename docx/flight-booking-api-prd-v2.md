# Product Requirements Document (v2): Flight Booking REST API

## 1. Project Overview / Core Purpose

The Flight Booking REST API is a backend-focused demonstration project designed to model a simplified, realistic flight-booking domain. It centers on four related resources — **Airlines**, **Flights**, **Customers**, and **Bookings** — connected through correct, well-defined relational integrity.

The API itself is the primary deliverable and the main object of evaluation. It is meant to demonstrate competence in REST API design, relational data modeling, and clean resource-oriented architecture — not to replicate the full complexity of a commercial airline booking system.

A minimal external client is included solely to prove that the API is consumable by a system outside its own codebase. The client is a supporting artifact that validates the API's usability; it is not a product goal in its own right, and its design, polish, and feature set should never compete with the API for scope or attention.

## 2. Goals and Non-Goals

### Goals
- Design and expose a RESTful API covering Airlines, Flights, Customers, and Bookings.
- Model accurate relationships between these resources (one-to-many and many-to-many via a join resource).
- Support relationship-aware queries (e.g., flights belonging to an airline, bookings belonging to a customer).
- Support reasonable filtering on flights (e.g., by origin, destination, date).
- Enforce basic data integrity through validation (e.g., a booking cannot reference a nonexistent customer or flight).
- Populate the system with realistic-looking seeded data.
- Provide a minimal external client that proves the API works when consumed independently.
- Expose all list endpoints with consistent pagination (default limit 20, max limit 100, total count, and a `hasMore` indicator), consistent filtering (minimum two filterable fields per resource where applicable), and consistent sorting (`sort` and `order` parameters).
- Use non-sequential, non-guessable generated identifiers (e.g., UUIDs) for all resources rather than sequential integers.
- Version the API from `/v1/` at launch to establish a stable contract for future changes.
- Use a consistent response envelope (`data` + `meta`) and a consistent error response shape across all endpoints.
- Apply basic rate limiting to the public API (configurable, targeting ~100 requests/minute), applied by IP or globally — not per API key or authenticated client.

### Non-Goals
This project explicitly does not aim to:
- Implement authentication, authorization, or user account management.
- Process or simulate payments.
- Integrate with real airline data providers (e.g., Amadeus, Skyscanner).
- Provide an admin dashboard or any dedicated management UI.
- Support complex booking workflows (holds, cancellations, refunds, waitlists, status transitions).
- Support multi-leg or connecting flight itineraries.
- Model seat maps, fare classes, loyalty programs, or baggage handling.
- Send notifications or emails.
- Reflect real-time data such as live flight status, dynamic pricing, or live seat availability decrementing.

## 3. Resource Definitions

All resources use generated, non-sequential identifiers (e.g., UUIDs) rather than sequential integers. Every field below is explicitly marked required or optional.

### Airline
Represents a company that operates flights.
- `id` — generated identifier (required)
- `name` — required
- `code` — IATA/ICAO-style code (required)
- `country` — country of origin (required)

### Flight
Represents a single scheduled flight instance operated by an airline.
- `id` — generated identifier (required)
- `airline_id` — reference to Airline (required)
- `flight_number` — required
- `origin` — required
- `destination` — required
- `departure_time` — required
- `arrival_time` — required
- `price` — required
- `seat_capacity` — total seat capacity (required). This field is **informational only** — it is not validated against at booking time in this version (see Section 5, item 5). Overbooking is not prevented.

### Customer
Represents a person who can make bookings.
- `id` — generated identifier (required)
- `full_name` — required
- `email` — required
- `phone_number` — optional

### Booking
Represents a single customer's reservation on a single flight.
- `id` — generated identifier (required)
- `customer_id` — reference to Customer (required)
- `flight_id` — reference to Flight (required)
- `booking_timestamp` — required
- `seats_booked` — number of seats booked (required, default: 1)

## 4. Relationships and Data Model Summary

- **Airline → Flights:** One airline operates many flights. Each flight belongs to exactly one airline.
- **Customer → Bookings:** One customer can create many bookings. Each booking belongs to exactly one customer.
- **Flight → Bookings:** One flight can be booked by many customers. Each booking references exactly one flight.
- **Customer ↔ Flight:** These two resources have no direct relationship. They are connected indirectly through Booking, which acts as the join resource resolving what would otherwise be a many-to-many relationship.

In plain terms: Airlines own Flights, Customers own Bookings, and each Booking ties one Customer to one Flight.

### Deletion Behavior
Deleting an Airline, Flight, or Customer that has dependent records (Flights, Bookings) is rejected with an error rather than cascading or silently orphaning records. Bookings may be deleted freely, representing cancellation (see Section 5, item 2 and Section 6).

## 5. Resolved Assumptions

1. **Booking cardinality:** A booking maps to exactly one flight. Multi-flight bookings (round trips, multi-city itineraries) are excluded because they would require introducing itinerary-level logic that isn't necessary to demonstrate core relational API design.

2. **Booking state:** A booking does not carry a status field. Its existence in the system is its state — if a booking record exists, it is considered active. Cancellation/status workflows are excluded as part of the confirmed non-goals around complex booking states. Deletion of a booking represents cancellation.

3. **Customer identity:** Customers have full CRUD support through the API. Customer creation is required because the minimal client must be able to register a customer before demonstrating the booking write-path; without it, the client's write-path demo would depend on pre-seeded data it cannot itself produce.

4. **Flight uniqueness:** A flight represents a single, specific, dated/scheduled instance (e.g., "BA123 departing Oct 5, 2026"), not a recurring route template. This keeps the data model simple and avoids needing a separate scheduling/recurrence concept.

5. **Capacity/availability:** Flights have a fixed total seat capacity attribute, but the API does not enforce live decrementing of available seats as bookings are made. Booking creation does not validate against remaining capacity; a Flight's seat capacity is a display-only field and overbooking is not prevented in this version. This is consistent with the exclusion of real-time data from scope.

6. **Data lifecycle:** Airlines and Flights support full CRUD through the API (not just static seed data). This keeps the API demonstrably complete across all four resources rather than treating two of them as read-only fixtures, without requiring any admin UI to manage them.

7. **Client scope:** The demo client demonstrates exactly one success path (create a booking) and one basic failure path (attempt a booking with invalid input and display the resulting error). It also displays flight data as a baseline read capability. It does not implement broader error-state handling beyond this, and does not expand into a full booking experience.

## 6. API Behavior Overview

*(Conceptual only — no route paths, verbs, or implementation detail at this stage.)*

- **Airlines:** Support creating, viewing, updating, deleting airline records, and retrieving the list of flights belonging to a given airline. List endpoint follows the pagination/filtering/sorting standard defined in Section 2.
- **Flights:** Support creating, viewing, updating, deleting flight records; support filtering flights by at least origin and destination (with date as a third optional filter); support retrieving the list of bookings associated with a given flight. List endpoint follows the pagination/filtering/sorting standard defined in Section 2.
- **Customers:** Support creating, viewing, updating, deleting customer records, and retrieving the list of bookings belonging to a given customer. List endpoint follows the pagination/filtering/sorting standard defined in Section 2.
- **Bookings:** Support creating and viewing bookings, with validation ensuring a booking references an existing customer and an existing flight. **Bookings are immutable after creation — no update operation is supported.** The only mutating operations on a Booking are creation and deletion; deletion represents cancellation, per Section 5, item 2.

## 7. Success Criteria

This project is considered successful as a demonstration piece when the following, checkable conditions are all true:

- Re-running the seed process any number of times produces the same dataset without duplicate records.
- All four resources' list endpoints correctly apply pagination, filtering, and sorting as defined in Section 2.
- Foreign key integrity is enforced: booking creation against a nonexistent Customer or Flight ID returns a client error (4xx), never a 500 or silent success.
- The minimal client successfully performs its one success path and one failure path (per Section 5, item 7) against the deployed API, not a local copy.
- No excluded feature (Section 8) is present in the implementation.

## 8. Explicit Exclusions

The following are confirmed out of scope for this project and must not be reintroduced without a deliberate, separate scoping decision:
- Authentication, authorization, or user account systems.
- Payment processing or payment simulation of any kind.
- Integration with real airline data providers or external booking systems.
- An admin dashboard or any dedicated management interface beyond the API itself.
- Complex booking workflows: holds, cancellations-as-a-status, refunds, waitlists, or multi-state booking transitions.
- Multi-leg or connecting flight itineraries.
- Seat maps, fare classes, loyalty/rewards programs, and baggage handling.
- Notification systems (email, SMS, push).
- Real-time data behavior: live flight status updates, dynamic pricing, or live seat-availability decrementing.
- Rate limiting is applied by IP or globally, not per API key or per authenticated client — no client-identification or API-key-issuance system is introduced as a side effect of rate limiting.
