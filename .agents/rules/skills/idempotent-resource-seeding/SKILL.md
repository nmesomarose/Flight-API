---
trigger: always_on
---

---
name: idempotent-resource-seeding
description: Write or modify the seed script for Airlines, Flights, Customers, or Bookings. Triggers on seed script, seed data, populate database, sample data, rerun seed, seeding order.
---

# Idempotent Resource Seeding

What this teaches: the dedupe mechanism and cross-resource order needed so seeding never creates duplicates and never violates a foreign key. Laws live in `data-integrity.md` (seed idempotency requirement) and `resources-and-relationships.md` (the foreign key graph that forces seeding order).

## Procedure

1. Seed Airlines first. They have no foreign key dependencies.
2. Seed Customers next, in any order relative to Airlines and Flights, since Customer has no foreign key dependencies either. It must only exist before Bookings are seeded.
3. Seed Flights after Airlines, since every Flight requires a valid `airline_id`.
4. Seed Bookings last, since every Booking requires a valid `customer_id` and `flight_id`, both of which must already exist.
5. For each resource, pick a stable natural key that identifies "this is the same seed record" across runs — for example, an airline's code, a flight's number plus departure time, or a customer's email. This key is only for duplicate detection.
6. Before inserting a record, check whether a record with that natural key already exists.
7. If it exists, skip inserting it again.
8. If it does not exist, generate a new non-sequential ID for it (`identity-and-contract.md`) and insert it.
9. Never use the natural key itself as the record's public ID — the ID must still be a generated, non-sequential value.
10. After seeding completes, confirm running the whole process again produces zero new records.

## Code skeleton
function seedAirlines(airlineList):
for airline in airlineList:
if not existsByNaturalKey("Airline", "code", airline.code):
insert("Airline", { id: generateNonSequentialId(), ...airline })

function seedFlights(flightList):
for flight in flightList:
naturalKey = flight.flightNumber + flight.departureTime
if not existsByNaturalKey("Flight", "naturalKey", naturalKey):
airlineId = findIdByNaturalKey("Airline", "code", flight.airlineCode)
insert("Flight", { id: generateNonSequentialId(), airline_id: airlineId, ...flight })

function seedCustomers(customerList):
for customer in customerList:
if not existsByNaturalKey("Customer", "email", customer.email):
insert("Customer", { id: generateNonSequentialId(), ...customer })

function seedBookings(bookingList):
for booking in bookingList:
naturalKey = booking.customerEmail + booking.flightNaturalKey
if not existsByNaturalKey("Booking", "naturalKey", naturalKey):
customerId = findIdByNaturalKey("Customer", "email", booking.customerEmail)
flightId = findIdByNaturalKey("Flight", "naturalKey", booking.flightNaturalKey)
insert("Booking", { id: generateNonSequentialId(), customer_id: customerId, flight_id: flightId, ...booking })

function runSeed():
seedAirlines(data.airlines)
seedCustomers(data.customers)
seedFlights(data.flights)
seedBookings(data.bookings)

## Traps

- Seeding Flights before Airlines exist, causing a foreign key failure.
- Seeding Bookings before their Customers or Flights exist.
- Using an auto-increment counter as the dedupe key, which resets or shifts between runs and causes duplicates.
- Using the natural key (e.g., email or flight number) as the actual record ID instead of generating a proper non-sequential ID.
- Forgetting to re-check the natural key on every run, so re-running the script doubles the dataset.

## Verify before done

- [ ] Running the seed script once produces the expected number of records for each resource.
- [ ] Running the seed script a second time produces zero additional records.
- [ ] Every seeded Flight references a valid, already-seeded Airline.
- [ ] Every seeded Booking references a valid, already-seeded Customer and Flight.
- [ ] Every seeded record has a generated, non-sequential ID, not the natural key used for dedup.

Write tests for each checklist item above before marking the seed script complete.