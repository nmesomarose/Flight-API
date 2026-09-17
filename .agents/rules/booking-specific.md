---
trigger: always_on
---

# booking-specific.md

Governs Booking's unique behavior. General resource and deletion rules live in `resources-and-relationships.md`.

## Cardinality
- A Booking MUST reference exactly one Flight. Multi-flight, round-trip, or multi-city bookings MUST NOT be implemented.

## State
- A Booking MUST NOT have a status field. The existence of a Booking record is its only state — there is no "pending," "confirmed," or "cancelled" state to track.

## Immutability
- Bookings MUST be immutable after creation. No update operation MUST be implemented for Bookings.
- The only mutating operations on a Booking are creation and deletion.
- Deleting a Booking represents cancellation. Unlike Airline, Flight, or Customer, a Booking MUST always be deletable and MUST NOT be rejected on the basis of dependent records (Bookings have no dependents).

## Capacity
- Booking creation MUST validate that the referenced `customer_id` and `flight_id` exist.
- Booking creation MUST NOT validate against a Flight's remaining seat capacity. Overbooking prevention MUST NOT be implemented. A Flight's seat capacity is informational only.