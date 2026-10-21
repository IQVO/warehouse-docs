---
id: domain-events
title: Domain events
sidebar_label: Domain events
description: Every event returns-processing publishes or consumes — seven published types on warehouse.returns-processing.events through the transactional outbox, and four consumed sibling types feeding local copies.
---

# Domain events

Every event this context publishes or consumes, with the full CloudEvents
`type`. The contract is
[`apis/asyncapi.yaml`](https://github.com/IQVO/returns-processing/blob/develop/apis/asyncapi.yaml);
the envelope (`specversion` 1.0, `id`, `source` `/warehouse/returns-processing`,
`type`, `subject`, `time`, `datacontenttype` `application/json`,
`dataschema`) is built only by `internal/adapters/kafka/cloudevents`. Payload
fields are snake_case and timestamps are RFC 3339 UTC.

## Published

`dataschema` is `urn:warehouse:returns-processing:events:<EventName>:v1`; the
Kafka header `content-type` is `application/cloudevents+json; charset=UTF-8`;
the Kafka key = the subject. The analytics mirror
(`warehouse.returns-processing.analytics`) is planned, not built (ADR 0004).

| Event | Full type | Subject / key | Raised by |
| --- | --- | --- | --- |
| ReturnAuthorized | `com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorized` | rmaId | `AuthorizeReturn` (REST `POST /returns`) |
| ReturnAuthorizationRejected | `com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorizationRejected` | rmaId | `RejectReturn` |
| ReturnReceiptOpened | `com.warehouse.wms.returns-processing.returnreceipt.ReturnReceiptOpened` | receiptId | `OpenReturnReceipt` (`POST /returns/{rmaId}/receipts`) |
| ReturnLineInspected | `com.warehouse.wms.returns-processing.returnreceipt.ReturnLineInspected` | receiptId | `InspectReturnLine` (`POST /receipts/{receiptId}/lines/{lineNo}/inspect`) |
| UnexpectedReturnReceived | `com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived` | receiptId | `OpenReturnReceipt`, one per UNEXPECTED line |
| DispositionDecided | `com.warehouse.wms.returns-processing.disposition.DispositionDecided` | dispositionId | `DecideDisposition` (same transaction as the inspection) or `OverrideDisposition` |
| ReturnLineStaged | `com.warehouse.wms.returns-processing.disposition.ReturnLineStaged` | dispositionId | raised exactly once per RESTOCK disposition |

### Payloads

| Event | `data` fields |
| --- | --- |
| ReturnAuthorized | `rma_id`, `order_id`, `line_no`, `sku`, `quantity`, `site_id`, `reason_code`, `window_ends_at`, `authorized_at` |
| ReturnAuthorizationRejected | `rma_id`, `order_id`, `line_no`, `sku`, `quantity`, `rejection_code`, `rejected_at` |
| ReturnReceiptOpened | `receipt_id`, `rma_id` (nullable), `site_id`, `opened_at`, `lines:[{line_no, sku, quantity, rma_id (nullable)}]` |
| ReturnLineInspected | `receipt_id`, `line_no`, `sku`, `quantity`, `grade` (`A\|B\|C\|SCRAP`), `reason_codes:[]`, `inspected_at` |
| UnexpectedReturnReceived | `receipt_id`, `line_no`, `sku`, `quantity`, `site_id`, `received_at` |
| DispositionDecided | `disposition_id`, `receipt_id`, `line_no`, `sku`, `quantity`, `grade`, `outcome` (`RESTOCK\|REFURBISH\|LIQUIDATE\|DISPOSE\|RTV`), `policy_version`, `supersedes` (nullable), `reason` (nullable), `decided_at` |
| ReturnLineStaged | `receipt_id`, `line_no`, `sku`, `quantity`, `condition` (`"Good"`), `received_at`, `rma_id`, `disposition_id`, `site_id` |

`ReturnLineStaged`'s `data` is inbound-receiving's `ReceiptLineReceived` shape
plus `rma_id`, `disposition_id` and `site_id`: `inventory-storage` consumes it
into its staged-receipt use case (`BookReturnLine` in front of
`ReceiveStock`, its ADR 0044) with no synchronous call in either direction.
Golden files pin the exact bytes of every type
(`internal/adapters/outbound/kafka/testdata/*.golden.json`).

Consumers of the published events: `inventory-storage` reads
`ReturnLineStaged` (its ADR 0044, group `RETURN_LINE_CONSUMER_GROUP`,
ignoring every other type on the topic), and `exception-management` reads
`UnexpectedReturnReceived` (its ADR 0003, group
`RETURNS_EXCEPTIONS_CONSUMER_GROUP`). Neither service is deployed, so no edge
runs today.

## Consumed

The consumed messages are the producers' own contracts, restated in this
context's AsyncAPI and never imported. Each feeds a durable local copy; the
CloudEvents `id` claim and the effect commit in one transaction, and the
offset is committed only afterwards.

| Full type | Topic | Key | Effect |
| --- | --- | --- | --- |
| `com.warehouse.wms.product-master.product.ProductClassified` | `warehouse.product-master.events` | sku | upsert `product_classifications` only when `version` is greater than the stored one; feeds the disposition policy's product-class axis |
| `com.warehouse.wes.order-management.order.OrderAllocated` | `warehouse.order-management.events` | order id | upsert `allocated_order_lines`, one row per (order_id, line_no) with its SKU |
| `com.warehouse.wes.order-management.order.OrderPartiallyAllocated` | `warehouse.order-management.events` | order id | same, for the allocated lines only |
| `com.warehouse.wes.fulfillment-execution.package.PackageManifested` | `warehouse.fulfillment.events` | package id | upsert `manifested_work_units` after reversing `order_ref` (`{order_id}-line-{line_no}`) into the (order, line) key `AuthorizeReturn` checks |

Consumer groups come from `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`,
`ORDER_LINES_CONSUMER_GROUP` and `MANIFEST_CONSUMER_GROUP` (mandatory env
vars; a missing one is a boot error). Every other type on those topics is
ignored; anything that fails CloudEvents validation is WARN-logged and
committed past; a payload that can never apply is dead-lettered at once.

## Example: ReturnAuthorized

From the golden test file (`return_authorized.golden.json`):

```json
{
  "specversion": "1.0",
  "id": "9a7d2e64-1b3f-4c8a-9d5e-2f6b8a4c1e70",
  "source": "/warehouse/returns-processing",
  "type": "com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorized",
  "subject": "rma-1",
  "time": "2026-10-21T09:30:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:returns-processing:events:ReturnAuthorized:v1",
  "data": {
    "rma_id": "rma-1",
    "order_id": "ord-7c9e",
    "line_no": 3,
    "sku": "SKU-BOOK-0001",
    "quantity": 2,
    "site_id": "site-1",
    "reason_code": "DAMAGED",
    "window_ends_at": "2026-10-21T11:30:00Z",
    "authorized_at": "2026-10-21T09:30:00Z"
  }
}
```
