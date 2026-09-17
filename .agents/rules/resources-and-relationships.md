---
trigger: always_on
---

# resources-and-relationships.md

Governs the four resource types and the relationships between them. Booking-specific nuances live in `booking-specific.md`, not here.

## Resource set
- The project MUST contain exactly four resource types: Airline, Flight, Customer, Booking.
- No additional resource type MUST be introduced without an explicit change to the PRD.

## Relationships
- Every Flight MUST reference an existing Airline (`airline_id`). A Flight MUST NOT be created without a valid Airline reference.
- Every Booking MUST reference an existing Customer (`customer_id`) and an existing Flight (`flight_id`).
- Customer and Flight MUST NOT have any direct relationship or join table between them. They are connected only indirectly, through Booking.

## Deletion behavior
- Deleting an Airline, Flight, or Customer that has dependent records (Flights for an Airline; Bookings for a Flight or Customer) MUST be rejected with an appropriate 4xx response. See `data-integrity.md` for the general rule against 500 responses on invalid operations.
- Cascading deletes and silent orphaning of dependent records MUST NOT occur.
- Booking is the exception to this rule: see `booking-specific.md` for Booking's own deletion behavior.

## Out of scope for this file
- The specific HTTP status code used for a rejected deletion (e.g., 409 vs. 422) is NOT specified by the PRD and MUST NOT be locked here — only that it MUST be a 4xx-family response.