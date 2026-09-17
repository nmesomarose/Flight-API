---
trigger: always_on
---

---
name: list-endpoint-pagination-filter-sort
description: Build any endpoint that returns a collection, including primary resource lists and relationship-scoped lists. Triggers on list endpoint, GET collection, flights by airline, bookings by customer, bookings by flight, pagination, filtering, sorting.
---

# List Endpoint: Pagination, Filtering, Sorting

What this teaches: the mechanical build order for a compliant list endpoint. Laws live in `identity-and-contract.md` (pagination/filtering/sorting requirements) and `data-integrity.md` (invalid query parameter handling).

## Procedure

1. Parse query parameters: limit, offset or cursor, filter fields, `sort`, `order`.
2. If `limit` is missing, default it to 20. If `limit` exceeds 100, clamp or reject it — pick one behavior and apply it identically everywhere (`identity-and-contract.md` locks the bound, not the exact overflow behavior).
3. Validate every filter field against the resource's allowed filter fields (at least two fields must be supported per resource). If an unsupported filter field or an invalid value is passed, return 400 — do not crash and do not silently ignore it (`data-integrity.md`).
4. Validate `sort` against the resource's allowed sortable fields. Reject unknown fields with 400. Validate `order` is one of the accepted directions.
5. If this is a relationship-scoped list (flights for an airline, bookings for a customer, bookings for a flight), first confirm the parent resource exists. If it does not, return 404 before running the list query.
6. Apply the validated filters to the query.
7. Apply the validated sort and order to the query.
8. Run the query with the pagination bounds applied.
9. Compute the total matching record count and whether more records exist beyond the current page (`hasMore`).
10. Build the `meta` object with limit, count, and `hasMore` (and offset/cursor, whichever mechanism this project uses — apply the same one everywhere).
11. Shape the response with `data` as the array of records and `meta` as built above (`identity-and-contract.md`).

## Code skeleton
function handleList(resourceType, queryParams, parentId = null):
if parentId is not null:
if not existsCheck(getParentType(resourceType), parentId):
return errorResponse(404, "parent resource not found")
limit = parseLimit(queryParams.limit, default: 20, max: 100)
if limit is invalid:
    return errorResponse(400, "invalid limit")

filters = validateFilters(resourceType, queryParams)
if filters is invalid:
    return errorResponse(400, "invalid filter")

sortField, order = validateSort(resourceType, queryParams.sort, queryParams.order)
if sortField is invalid or order is invalid:
    return errorResponse(400, "invalid sort")

records, totalCount = queryWithPagination(resourceType, filters, sortField, order, limit, offset, parentId)
hasMore = (offset + records.length) < totalCount

return successResponse(
    data: records,
    meta: { limit: limit, total: totalCount, hasMore: hasMore }
)

## Traps

- Forgetting to apply the default `limit` of 20 when none is passed.
- Allowing `limit` above 100 through unchecked.
- Letting an unrecognized `sort` field pass straight into a raw query (crashes the query engine, or worse, becomes an injection point).
- Off-by-one errors in `hasMore` (checking `records.length < limit` instead of comparing against total count).
- Forgetting to check the parent resource exists on a relationship-scoped list, so a bad `airline_id` in the URL silently returns an empty list instead of 404.
- Mixing pagination mechanisms (offset on one endpoint, cursor on another) — whichever is picked must be applied to every list endpoint the same way.

## Verify before done

- [ ] Calling the list endpoint with no params returns 20 items and a correct `meta`.
- [ ] `limit=100` is accepted; a value above 100 is handled the same way on every resource.
- [ ] An invalid or unsupported filter field returns 400, not 500 and not silently ignored.
- [ ] An invalid `sort` field returns 400.
- [ ] Filtering on each of the resource's supported filter fields returns the correct subset.
- [ ] `hasMore` is `true` when more records exist and `false` on the last page.
- [ ] A relationship-scoped list against a nonexistent parent ID returns 404, not an empty list.

Write tests for each checklist item above before marking the endpoint complete.