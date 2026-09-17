---
trigger: always_on
---

---
name: referential-integrity-guard
description: Validate foreign key references on create and guard against orphaning dependents on delete. Triggers on foreign key check, FK validation, existence check, delete guard, dependent records, cascading delete, orphaned record.
---

# Referential Integrity Guard

What this teaches: the check order for foreign key validation on create, and dependency guarding on delete. Laws live in `data-integrity.md` (general FK principle), `resources-and-relationships.md` (specific FK pairs and deletion rejection), and `booking-specific.md` (Booking's deletion exception).

## Procedure

1. On create: identify every foreign key field on the resource being created. Flight has `airline_id`. Booking has `customer_id` and `flight_id`.
2. For each foreign key field, look up the referenced record by its ID before doing anything else with the request.
3. If any referenced record is missing, stop immediately and return 404. Do not proceed to persist the new record.
4. If every referenced record exists, allow creation to proceed.
5. On delete of an Airline: check whether any Flight references this Airline's ID.
6. On delete of a Flight: check whether any Booking references this Flight's ID.
7. On delete of a Customer: check whether any Booking references this Customer's ID.
8. If a dependency check in steps 5–7 finds any dependent record, stop and reject the delete. Do not cascade the delete to dependents and do not silently detach the reference.
9. If no dependent record is found, allow the delete to proceed.
10. On delete of a Booking: skip steps 5–8 entirely. Booking has no dependents and deletion is always allowed (`booking-specific.md`).

## Code skeleton
function assertForeignKeysExist(resourceType, requestBody):
for each fkField in getForeignKeys(resourceType):
referencedId = requestBody[fkField]
if not findById(getReferencedType(fkField), referencedId):
return false # caller returns 404
return true

function hasDependents(resourceType, id):
if resourceType == "Airline":
return countWhere("Flight", "airline_id", id) > 0
if resourceType == "Flight":
return countWhere("Booking", "flight_id", id) > 0
if resourceType == "Customer":
return countWhere("Booking", "customer_id", id) > 0
if resourceType == "Booking":
return false # no dependents, always deletable
return false

## Traps

- Running the existence check after the record is already partially written.
- Treating a missing foreign key as "create anyway, fix later" instead of a hard 404.
- Cascading deletes because it feels more convenient than rejecting them.
- Applying Booking's "always deletable" exception to Airline, Flight, or Customer by mistake.
- Checking dependents only one level deep and missing a resource type that also depends on the one being deleted.

## Verify before done

- [ ] Creating a Flight with a nonexistent `airline_id` returns 404 and nothing is persisted.
- [ ] Creating a Booking with a nonexistent `customer_id` returns 404 and nothing is persisted.
- [ ] Creating a Booking with a nonexistent `flight_id` returns 404 and nothing is persisted.
- [ ] Deleting an Airline that has Flights is rejected.
- [ ] Deleting a Flight that has Bookings is rejected.
- [ ] Deleting a Customer that has Bookings is rejected.
- [ ] Deleting a Flight with zero Bookings succeeds.
- [ ] Deleting a Booking always succeeds, regardless of any other data.

Write tests for each checklist item above before marking the guard complete.