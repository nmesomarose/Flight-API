---
trigger: always_on
---

# rate-limiting.md

Governs rate limiting on the public API.

## Requirement
- The public API MUST implement rate limiting.
- The rate limit MUST target approximately 100 requests per minute.
- The rate limit value MUST be configurable (e.g., via environment variable or config), not hard-coded inside request handlers.

## Scope
- Rate limiting MUST be applied by IP address or globally.
- Rate limiting MUST NOT be scoped per API key or per authenticated client.
- Implementing rate limiting MUST NOT introduce an API-key issuance system, client registration, or any form of authentication as a side effect.

## Behavior
- A request that exceeds the configured rate limit MUST receive a `429` response. Without this, rate limiting has no observable effect and does not satisfy the requirement.
- A `429` response MUST include a `Retry-After` header indicating when the client may retry. This is an explicit project requirement, not an optional convenience.