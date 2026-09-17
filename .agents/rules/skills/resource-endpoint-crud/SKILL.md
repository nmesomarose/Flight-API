---
trigger: always_on
---

---
name: resource-endpoint-crud
description: Build create, read, update, or delete endpoints for Airline, Flight, Customer, or Booking. Triggers on create endpoint, update endpoint, delete endpoint, CRUD handler, new resource route, add booking, delete flight, remove customer.
---

# Resource Endpoint CRUD

What this teaches: the correct order of operations for building a single resource's CRUD endpoint. Laws live in `identity-and-contract.md` (IDs, envelope, status codes), `resources-and-relationships.md` (foreign keys, deletion), `booking-specific.md` (Booking's exceptions), and `data-integrity.md` (validation, status code mapping).

## Procedure

1. Parse the request body. Check every required field is present and has the right type for the resource (PRD §3 field list).
2. If any required field is missing or malformed, stop and return 400. Do not proceed to the data layer with bad input (`data-integrity.md`).
3. If the resource has foreign key fields (`airline_id` on Flight; `customer_id` and `flight_id` on Booking), run the `referential-integrity-guard` skill before continuing. Do not write your own inline existence check here.
4. If a referenced record does not exist, stop and return 404.
5. Generate a new ID for the record. It must be a non-sequential, generated identifier (`identity-and-contract.md`). Never use an auto-increment integer.
6. If the resource is Booking, confirm this is a create or delete call only. There is no update operation for Booking (`booking-specific.md`). If an update is requested, do not build it — this is a locked exclusion.
7. If the resource is Booking, do not check remaining seat capacity. Booking creation checks only that `customer_id` and `flight_id` exist (`booking-specific.md`).
8. Persist the record.
9. Shape the success response with a top-level `data` key holding the record (`identity-and-contract.md`).
10. For delete on Airline, Flight, or Customer: before deleting, check for dependent records. Run the `referential-integrity-guard` skill's dependency check. If dependents exist, reject the delete; do not cascade (`resources-and-relationships.md`).
11. For delete on Booking: skip the dependency check. Booking deletion is always allowed and represents cancellation (`booking-specific.md`).
12. On any failure, map it to the correct code: 400 for malformed input, 404 for a missing referenced resource, 422 for a validation or business-rule failure, 429 for rate-limited requests (`data-integrity.md`). Never return 500 for bad input.
13. Shape every error response with the agreed consistent error structure, applied identically across every endpoint (`identity-and-contract.md`).

## Code skeleton

Language and framework are not locked by the project. Follow this shape regardless of stack.
function handleCreate(resourceType, requestBody):
errors = validateRequiredFields(resourceType, requestBody)
if errors:
return errorResponse(400, errors)
for each foreignKeyField in getForeignKeys(resourceType):
    if not existsCheck(foreignKeyField, requestBody[foreignKeyField]):
        return errorResponse(404, "referenced resource not found")

if resourceType == "Booking":
    # no capacity check here — forbidden by booking-specific.md
    pass

id = generateNonSequentialId()
record = buildRecord(id, requestBody)
save(record)

return successResponse(data: record)
function handleDelete(resourceType, id):
record = findById(resourceType, id)
if not record:
return errorResponse(404, "not found")
if resourceType != "Booking":
    if hasDependents(resourceType, id):
        return errorResponse(422, "cannot delete: dependent records exist")

remove(resourceType, id)
return successResponse(data: null)

## Traps

- Writing an update handler for Booking because "CRUD usually has one." It is forbidden.
- Checking foreign keys after the insert instead of before.
- Using a database auto-increment ID and calling it "good enough."
- Cascading a delete instead of rejecting it when dependents exist.
- Adding a seat-capacity check to Booking creation because it "seems safer."
- Returning 500 when a field is missing or malformed instead of 400.
- Forgetting the Booking delete exception and blocking it with a dependency check it doesn't need.

## Verify before done

- [ ] Creating a valid record of each resource type succeeds and returns the `data` envelope.
- [ ] Creating with a missing required field returns 400.
- [ ] Creating a Flight with a nonexistent `airline_id` returns 404.
- [ ] Creating a Booking with a nonexistent `customer_id` or `flight_id` returns 404.
- [ ] No code path validates Booking against remaining seat capacity.
- [ ] No update route exists for Booking.
- [ ] Deleting an Airline with existing Flights is rejected, not cascaded.
- [ ] Deleting a Flight or Customer with existing Bookings is rejected, not cascaded.
- [ ] Deleting a Booking always succeeds regardless of any other state.
- [ ] Generated IDs are non-sequential across multiple created records.

Write tests for each checklist item above before marking the endpoint complete.