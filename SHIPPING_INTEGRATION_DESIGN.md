# Shipping Integration Design Proposal

**Status:** Proposal only — implementation must wait for approval.

## Goal and scope

Add a controlled import path for shipping-company update files that records a tracking number, governorate, shipping status, source update time, and synchronization time. The design must preserve existing imported order batches and their legacy fields.

## Architectural decision: identifiers and matching

The `ID` from the order-import workbook is an **external source identifier**, not a guaranteed internal lifecycle key. It remains valuable for correlation but must not be treated as the sole durable identity during shipping integration.

The proposed matching order is:

1. Prefer a future stable internal `orderId` when the shipping source supplies a persisted internal correlation value.
2. Match an existing normalized tracking number only when it resolves to one order.
3. Use the normalized external source ID as a controlled fallback only when it resolves to one order in the selected month/source context.
4. Do not auto-update ambiguous matches. Put them in an unresolved-review result with the candidate details.
5. Do not use customer name or phone alone for an automatic write. They may be displayed as review evidence only.

This prevents an update from being applied to the wrong order when source IDs are reused, delayed, incomplete, or represent a different lifecycle.

## Shipping-file import cycle

1. The authorized user selects the source, target month/context, and shipping update file.
2. The importer validates the file type, sheet, required source columns, and row count; it normalizes whitespace, Arabic/Latin digits, status labels, dates, governorate names, and tracking-number formatting.
3. It detects duplicate rows in the file using a source-row fingerprint and keeps a row-level issue report.
4. It resolves each row through the matching policy above and presents a preview with **matched**, **unresolved**, **ambiguous**, **unchanged**, and **invalid** groups.
5. On confirmation, it applies only matched, changed rows with idempotent writes, records an audit entry, and persists an import/sync summary.
6. A result screen exposes counts, row-level errors, skipped duplicates, and last synchronization time. A retry is allowed only as a new idempotent run; it is not a workaround for unresolved matching.

## Backward-compatible Firestore fields

For each existing order item, introduce an optional nested `shipping` object:

```text
shipping: {
  trackingNumber: string | null,
  governorate: string | null,
  status: string | null,
  sourceUpdatedAt: Timestamp | null,
  lastSyncedAt: Timestamp | null,
  source: string | null,
  sourceRowHash: string | null
}
```

- All fields are optional; legacy orders remain valid without them.
- Existing flat/legacy shipping values, if any, remain readable. The implementation will use a documented dual-read path and write the nested object without deleting legacy data.
- `sourceRowHash` enables idempotent detection of an unchanged shipping row. `lastSyncedAt` is the system write time; `sourceUpdatedAt` is the time supplied by the shipping source.
- A shipping import summary should be stored separately from order data (for example under the existing month report as a dedicated `shippingSyncs` subcollection) so it does not enlarge the order-batch document.

## Firestore impact and constraints

- Existing `monthly_reports/{monthId}/orderBatches/{batchId}` items remain the source of order data; no destructive migration is proposed.
- Updates must respect Firestore document-size and write-batch limits. The implementation will chunk writes and use transactions only where a compare-and-write decision needs atomicity.
- The schema will add only optional fields. Any index will be added only after a concrete query needs it, rather than pre-emptively.
- Rules must authorize shipping imports separately from normal order editing, preserve locked/archived month protections, and require an active authorized user. All writes must be audited.

## Implementation plan after approval

1. Confirm the shipping provider's actual file schema, status vocabulary, source timestamps, and available correlation fields.
2. Add a shared parser/normalizer and deterministic row fingerprint tests.
3. Implement the matching service with explicit match outcomes; no UI code may bypass it.
4. Add the preview, confirmation, summary, unresolved-review UI, permission guards, and audit records.
5. Add optional `shipping` writes and dual-read display while retaining legacy compatibility.
6. Update Firestore Rules, deploy to a test environment/emulator first, then perform Firebase production UAT with a controlled sample.

## Test plan

- Parser: missing headers, reordered columns, Arabic digits, blank optional values, invalid dates, malformed tracking numbers, and duplicate source rows.
- Matching: internal ID, unique tracking number, unique external ID, missing match, duplicate/ambiguous match, reused external ID across contexts, and name/phone collision.
- Idempotency: same file twice, same row twice, a later source update, and a status-only update.
- Firestore: legacy order read, optional-field writes, locked/archived denial, permission denial, audit record creation, chunk boundaries, and no duplicate sync summary.
- UI/production UAT: preview counts, error report, search/filter of results, Dashboard/Orders shipping display, browser runtime/console checks, and Firestore verification of the applied update.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| External ID is reused or not lifecycle-stable | Treat it as a scoped fallback, never an unconditional primary key. |
| Multiple orders share customer details | Never auto-match by name/phone alone. |
| Provider status labels change | Keep a normalized mapping with unknown statuses flagged for review. |
| Large batches exceed Firestore limits | Chunk writes and store import summaries outside order-batch item arrays. |
| Legacy records lack shipping metadata | Use optional nested fields and dual-read compatibility. |
| Incorrect shipping write has operational impact | Require preview, unambiguous match, audit trail, and separate unresolved results. |

## Approval gate

No shipping code, rule, schema, or production-data change is authorized by this proposal. Implementation begins only after review and explicit approval of this document.
