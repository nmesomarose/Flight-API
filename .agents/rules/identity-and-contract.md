---
trigger: always_on
---

# identity-and-contract.md

Governs the API's external contract. Applies identically across all four resources.

## Identifiers
- All resource IDs MUST be generated, non-sequential identifiers (e.g., UUIDs).
- Sequential integer IDs MUST NOT be used for any resource.

## Versioning
- All API routes MUST be served under a `/v1/` prefix.
- The `/v1/` contract MUST NOT be broken by non-additive changes once established (e.g., removing or renaming an existing field).

## Response envelope
- Every successful response MUST use a top-level `data` key for the payload and a `meta` key for metadata (pagination info, counts, etc.).
- Every error response MUST use a single, consistent error shape across all endpoints (e.g., a stable set of error fields such as code and message). The exact field names are an implementation choice not yet fixed by the PRD, but MUST be applied identically everywhere once chosen.

## Pagination
- Every list endpoint MUST support pagination with a default limit of 20 and a maximum limit of 100.
- Every list endpoint's response MUST include a total record count and a `hasMore` indicator.
- The pagination mechanism (offset-based vs. cursor-based) is NOT specified by the PRD. Do not invent or lock a strategy here — whichever is chosen during implementation MUST be applied consistently across all four resources' list endpoints.

## Filtering and sorting
- Every list endpoint MUST support filtering on at least two fields where applicable to that resource.
- Every list endpoint MUST support sorting via `sort` and `order` query parameters.

## Out of scope for this file
- Field naming conventions (e.g., snake_case vs. camelCase) are NOT specified by the PRD and MUST NOT be treated as locked by this file.