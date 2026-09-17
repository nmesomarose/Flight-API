---
trigger: always_on
---

# agent-behaviour.md

Governs how this rule-file set relates to AGENTS.md and the PRD. This file does NOT restate coding style, dependency discipline, change discipline, security rules, or the uncertainty-resolution protocol — all of those are owned exclusively by AGENTS.md and MUST be followed as written there.

## Precedence
- The PRD is the source of truth for *what* to build.
- AGENTS.md is the source of truth for general agent behavior and for any topic not covered by one of the seven files in `.agents/rules/`.
- The relevant file in `.agents/rules/` is the source of truth for its specific topic (identity/contract, resources/relationships, booking, rate limiting, data integrity, consumer client).
- If a rule file and AGENTS.md ever appear to conflict, AGENTS.md and the PRD take precedence, and the conflict MUST be flagged rather than silently resolved by picking one side.

## Navigation
- Before implementing a change to the API's shape (IDs, versioning, envelope, pagination), consult `identity-and-contract.md`.
- Before implementing a change to a resource or its relationships, consult `resources-and-relationships.md`, and `booking-specific.md` if the resource is Booking.
- Before implementing anything related to request throttling, consult `rate-limiting.md`.
- Before implementing validation or seeding logic, consult `data-integrity.md`.
- Before implementing anything in the demo client, consult `consumer-client.md`.

## Unresolved ambiguity
- If a situation is not covered by the PRD, AGENTS.md, or any of these seven files, follow AGENTS.md's existing protocol for uncertainty: do not invent a requirement — stop and ask for clarification.