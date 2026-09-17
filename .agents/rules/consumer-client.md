---
trigger: always_on
---

# consumer-client.md

Governs the minimal external client. The client is architecturally separate from the API.

## Scope
- The client MUST demonstrate exactly one success path (creating a Booking) and one failure path (attempting a Booking with invalid input and displaying the resulting error).
- The client MAY also display flight data as a baseline read capability, consistent with the PRD.
- The client MUST NOT implement functionality beyond what is needed to demonstrate these paths (e.g., no full booking UX, no search UI beyond what's needed, no styling requirements beyond basic function).

## Integration boundary
- The client MUST consume the API only over HTTP, as an external caller.
- The client MUST NOT import API internals, access the database directly, or bypass the API in any way.
- The client MUST call the deployed public API URL, not `localhost` or any non-public address, as part of demonstrating that the API is externally consumable. This requirement covers the target URL only — it does not lock which hosting provider is used; that remains an open decision per AGENTS.md.

## Out of scope for this file
- The client's technology/framework is NOT specified by the PRD and MUST NOT be locked here.