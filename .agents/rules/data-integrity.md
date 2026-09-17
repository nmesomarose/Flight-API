---
trigger: always_on
---

# data-integrity.md

Governs cross-cutting correctness rules that apply to all resources.

## Seeding
- The seed process MUST be idempotent: running it any number of times MUST NOT create duplicate records.

## Input validation
- All request bodies and query parameters MUST be validated before reaching business logic or the data layer.
- A malformed or invalid resource ID MUST NOT produce a 500 error. It MUST be handled as a 4xx client error.
- An invalid query parameter (e.g., an out-of-range pagination value, an unrecognized sort field, a malformed filter value) MUST NOT produce a 500 error. It MUST be handled as a 4xx client error.

## Status code mapping
- The API MUST use `400` for malformed requests, `404` for a well-formed reference to a resource that does not exist, `422` for a well-formed request that fails validation or a business rule, and `429` for rate-limited requests. These MUST NOT be used interchangeably.

## Referential integrity
- Any field that references another resource by ID (e.g., `airline_id`, `customer_id`, `flight_id`) MUST be validated to reference an existing record before the dependent record is created. The specific pairs and their creation/deletion behavior are defined in `resources-and-relationships.md` and `booking-specific.md`; this rule states the general principle only.