# AGENTS.md — Flight Booking REST API

This file governs how an AI coding agent must behave while building this project inside Antigravity. **PRD v2 (`flight-booking-api-prd-v2.md`) is the source of truth for product requirements.** This file does not restate the PRD — it converts its non-negotiable requirements into direct operating rules, and adds agent-behavior rules the PRD does not cover.

If a conflict exists between this file and the PRD, the PRD wins on *what* to build; this file wins on *how* to build it. If something is ambiguous in both, stop and ask — see Section 7.

---

## 1. What is this project?

**Flight Booking REST API** is a backend-focused demonstration project. Its purpose is to prove competence in REST API design and relational data modeling — not to replicate a commercial airline booking system.

- **Core resources:** Airlines, Flights, Customers, Bookings.
- **What the API demonstrates:** correct relational integrity between four resources, consistent REST conventions (pagination, filtering, sorting, versioning, response/error shape), and basic production hygiene (rate limiting).
- **Role of the minimal consumer:** a small external client that proves the API is consumable outside its own codebase. It is a supporting artifact, not a second product. It demonstrates exactly one success path and one failure path (see PRD Section 5, item 7) — it is not to be expanded beyond that.
- **Source of truth:** `flight-booking-api-prd-v2.md`. Any product question ("should this resource have X field/behavior?") is answered by the PRD, not by this file, not by convention, and not by what a real airline system would do.

---

## 2. What is locked?

### Explicitly locked by the PRD
- Four resources only: Airlines, Flights, Customers, Bookings (PRD §2, §3).
- Generated, non-sequential identifiers (e.g., UUIDs) for all resources — never sequential integers (PRD §2, §3).
- API versioned from `/v1/` at launch (PRD §2).
- Consistent response envelope (`data` + `meta`) and consistent error response shape across all endpoints (PRD §2).
- List endpoints: pagination with default limit 20, max limit 100, total count, `hasMore`; minimum two filterable fields per resource where applicable; sorting via `sort` and `order` (PRD §2, §6).
- Rate limiting on the public API, configurable, targeting ~100 requests/minute, applied by IP or globally — never per API key or authenticated client (PRD §2, §8).
- Bookings are immutable after creation: create and delete only, no update (PRD §5 item 2, §6).
- Deletion of Airlines, Flights, or Customers with dependent records is rejected, not cascaded (PRD §4).
- Booking creation validates that `customer_id` and `flight_id` reference existing records; it does **not** validate against remaining seat capacity (PRD §5 items 3, 5).
- Seeding must be repeatable without producing duplicate records (PRD §7).

### Not yet specified
The following are **not specified in the PRD — do not invent or lock a choice in this file**. The first implementation task that requires one of these must raise it explicitly rather than assume it:
- Programming language / runtime
- Web framework
- Database engine
- ORM or query layer
- Hosting/deployment provider
- Testing framework
- CI/CD tooling
- Frontend framework or approach for the minimal consumer client

Whatever is chosen for these, once chosen for real in the project, becomes locked going forward — do not switch frameworks, databases, or ORMs mid-project without an explicit decision recorded outside this file.

---

## 3. What must never happen?

**Breaking a rule in this section means the implementation has failed the project requirements, even if the code runs successfully.**

- Never use sequential integer IDs for any resource. (PRD §2, §3)
- Never implement authentication, authorization, login, or user accounts of any kind. (PRD §2, §8)
- Never implement payment processing or payment simulation. (PRD §8)
- Never integrate with a real airline data provider or external booking system. (PRD §8)
- Never build an admin dashboard or any management UI beyond the API itself. (PRD §8)
- Never implement booking status, holds, cancellation-as-a-status, refunds, or waitlists. A booking's existence is its only state. (PRD §5 item 2, §8)
- Never implement an update operation for Bookings. Bookings may only be created or deleted. (PRD §6)
- Never implement multi-leg or connecting-flight itineraries; a booking always maps to exactly one flight. (PRD §5 item 1, §8)
- Never implement seat maps, fare classes, loyalty programs, or baggage handling. (PRD §8)
- Never send notifications or emails (SMS, push, or otherwise). (PRD §8)
- Never implement live/real-time behavior: no live flight status, no dynamic pricing, no live seat-availability decrementing. `seat_capacity` is informational only. (PRD §3, §5 item 5, §8)
- Never validate a booking against remaining seat capacity or block a booking for being "overbooked." (PRD §5 item 5)
- Never cascade-delete an Airline, Flight, or Customer that has dependent records; reject the deletion instead. (PRD §4)
- Never scope rate limiting to an API key or authenticated client, and never introduce an API-key-issuance or client-identification system as a side effect of adding rate limiting. (PRD §8)
- Never break the `/v1/` versioning contract or the `data`/`meta` response envelope once established. (PRD §2)
- Never allow a seed re-run to create duplicate records. (PRD §7)
- Never let a malformed ID or invalid query parameter produce an unhandled server error; it must be handled as a client error.
- Never expand the minimal client beyond its one success path and one failure path into a fuller booking experience. (PRD §5 item 7)

---

## 4. How is the work arranged?

The PRD does not lock a technology stack, so no framework-specific folder layout can be locked here. The following organizational rules are structural and apply regardless of stack:

- **Separation of concerns:** API/route handling, request validation, business/domain logic, and data access must be kept in distinct layers. A route handler must not contain raw data-access logic, and a data-access layer must not contain request/response formatting.
- **Resource boundaries:** Each of the four resources (Airlines, Flights, Customers, Bookings) should have its own clearly bounded module/directory for its route handling, validation, and data access. Cross-resource logic (e.g., "flights for an airline") belongs to the owning resource's module, not scattered across both.
- **Validation location:** Input validation (request bodies, query parameters, IDs) must happen at the boundary, before business logic executes — not deep inside data-access code.
- **Configuration:** Rate-limit values and other tunable settings must live in configuration (environment variables or a config module), not hard-coded inside request handlers. (PRD §2 — "configurable")
- **Testing:** Test code should live in a clearly separated location from application code, organized to mirror the resource boundaries above.
- **Consumer client:** The minimal external client must live in its own directory, physically separated from the API codebase, and must call the API over HTTP like any other external consumer — it must never import API internals directly.

**A specific folder tree is not provided here because the stack is not yet locked.** Once a language/framework is chosen, propose a concrete folder structure consistent with the rules above before writing implementation code, rather than defaulting to whatever the framework's generator produces without review.

---

## 5. How should the code look?

- Code must be clean, readable, and maintainable — prefer the simplest solution that satisfies the PRD over a more general or "flexible" one.
- Avoid duplicated logic; extract shared logic only when duplication is real, not preemptively.
- Use meaningful, descriptive names for variables, functions, and modules.
- Keep responsibilities separated per Section 4 — a function or module should do one thing.
- Avoid dead code, commented-out code, and unused abstractions.
- Avoid over-engineering: do not build plugin systems, generic frameworks, or configurability the PRD does not ask for.
- Do not introduce a specific coding style, linter config, or library beyond what the project has already established once a stack is chosen.
- Code must be compatible with a supported stable/LTS version of whichever language/runtime is actually selected. **Do not claim or assume LTS status for a technology that has not yet been selected** — this is a placeholder rule until Section 2's "not yet specified" list is resolved.

### Dependency discipline
- Do not add a new dependency without first checking whether the existing project (language standard library, already-installed packages) can solve the problem.
- Every new dependency must be justified against a concrete requirement in the PRD or an explicit instruction — not convenience or familiarity alone.

### Change discipline
- Inspect existing code before modifying it; do not rewrite working code without reason.
- Make focused changes scoped to the task at hand; do not touch unrelated files.
- Preserve working functionality — a change that fixes one thing must not silently remove or alter another.
- Do not introduce features, fields, or endpoints that are not in the PRD, even if they seem like natural additions.

### Security and secrets
- Never commit secrets, API keys, or credentials of any kind.
- Never hard-code credentials in source files.
- Never commit `.env` files (or equivalent) that contain secrets.
- Never print or log secret values, including in error messages or debug output.

---

## 6. What counts as done?

Before reporting a feature or task as complete, the agent must verify:

1. The requested feature is implemented as specified.
2. The implementation follows the PRD — specifically checked against Sections 2, 3, 4, 5, 6, and 8.
3. No excluded functionality (Section 3 of this file / PRD §8) was introduced, even incidentally.
4. Relevant validation exists (required fields, foreign-key existence, ID format).
5. Relevant error cases have been exercised — not just the happy path (e.g., invalid ID, missing field, nonexistent foreign key, out-of-range pagination).
6. The project builds successfully.
7. The project passes whatever checks are actually available in the project (tests, linting, type-checking) — do not skip available checks and do not claim a check passed without running it.
8. The agent reports exactly what was completed — no vague or aspirational status claims.

**The agent must never claim something works merely because it wrote the code.** A feature is only "done" once it has been run or tested, not merely authored.

At the end of any meaningful unit of work, produce a completion checklist in this form:

| Requirement | Status | Evidence / Check Performed |
|---|---|---|
| e.g., Booking creation validates customer_id exists | Done | Tested with nonexistent ID → 404 returned |
| e.g., Pagination defaults to limit 20 | Done | Verified list response `meta` shows limit: 20 |

---

## 7. When the agent is unsure

This is a critical rule. When facing an ambiguous or unspecified requirement, the agent must **not**:

- Invent a new feature or business rule.
- Expand scope beyond the PRD.
- Silently change an existing requirement.
- Create unnecessary architecture "just in case."
- Introduce an unrelated dependency to work around uncertainty.
- Write spaghetti code to force something to work.
- Assume a common industry feature (e.g., overbooking prevention, booking status, authentication) is required just because real-world flight-booking systems have it. The PRD's explicit exclusions override real-world convention.

Instead, the agent must, in this order:

1. Check the PRD (`flight-booking-api-prd-v2.md`).
2. Check this file (`AGENTS.md`).
3. Check the existing implementation for an established pattern.
4. Look for a comparable, already-resolved decision elsewhere in the project.
5. Choose the smallest solution consistent with the documented requirements.

**If the ambiguity still cannot be resolved from project documentation, stop and ask for clarification rather than inventing a requirement.** A wrong guess that looks confident is worse than a pause for clarification.