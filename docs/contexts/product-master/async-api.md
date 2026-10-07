---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for product-master — one published integration topic, four live local-copy consumers of ProductClassified, the migration-only legacy importer, the CloudEvents envelope and the version-guarded consumer rule.
---

# Async API

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.product-master.events` | **Published** (this context is the exclusive publisher) | `ProductRegistered`, `ProductDescriptionChanged`, `ProductClassified`, `ProductDimensionsDeclared`, `ProductMeasured` | **Live**. `inventory-storage` (its ADR 0034), `order-management` (ADR 0036), `wes-work-planning` (ADR 0035) and `fulfillment-execution` (ADR 0039) each keep a local copy of `ProductClassified`. The other four types have no consumer yet |
| `warehouse.inventory.events` | **Consumed** (producer: `inventory-storage`) | `com.warehouse.wms.inventory-storage.product.ProductClassified` only (every other type is ignored) | **Migration only**. Opt-in via `LEGACY_IMPORT_CONSUMER_GROUP` (unset = importer not started); removed at stage E of [ADR 0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md) |

There is no analytics topic in v1
([ADR 0004](https://github.com/IQVO/product-master/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md),
"Not published (yet)").

## The envelope

Every message is CloudEvents 1.0 in structured content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`) — the fleet-wide,
mandatory [Event Standard](/strategic-design/event-standard-cloudevents). Here
is `ProductClassified`:

```json
{
  "specversion": "1.0",
  "id": "0f6d8a2b-3c4e-4d5f-8a9b-7c6d5e4f3a2b",
  "source": "/warehouse/product-master",
  "type": "com.warehouse.wms.product-master.product.ProductClassified",
  "subject": "SKU-1",
  "time": "2026-10-06T21:02:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:product-master:events:ProductClassified:v1",
  "data": {
    "sku": "SKU-1",
    "handling_tags": ["Hazmat", "TemperatureSensitive"],
    "temperature_class": "Frozen",
    "dot_hazard_class": 3,
    "classification_source": "native",
    "version": 3
  }
}
```

The `type` is `com.warehouse.wms.product-master.product.<EventName>`; the
entity segment is `product` (the aggregate). `subject` and the Kafka message
key are the SKU, so one product's events stay ordered on one partition.
`dataschema` is `urn:warehouse:product-master:events:<EventName>:v1`; a
breaking payload change gets a new `.v2` type, an existing one is never
mutated.

## Published types

Every payload carries `sku` and the aggregate `version` after the change. A
command that changes nothing raises no event.

| Type suffix (after `com.warehouse.wms.product-master.product.`) | Raised by | Payload (`data`) |
| --- | --- | --- |
| `ProductRegistered` | `PUT /products/{sku}` for a new SKU; the legacy importer for an unknown SKU | `sku`, `description`, `version` (always 1) |
| `ProductDescriptionChanged` | `PUT /products/{sku}` with a different description | `sku`, `description`, `version` |
| `ProductClassified` | `PUT /products/{sku}/classification`; the legacy importer | `sku`, `handling_tags[]`, `temperature_class`?, `dot_hazard_class`?, `classification_source` (`native` or `legacy-import`), `version` |
| `ProductDimensionsDeclared` | `PUT /products/{sku}/dimensions/declared` | full physical profile: `sku`, `declared`?, `measured`?, `effective`?, `effective_source`, `discrepancy`, `version` |
| `ProductMeasured` | `PUT /products/{sku}/dimensions/measured` | the same full physical profile |

`?` marks a field omitted when unset. `handling_tags` is in the stable order
Hazmat, Fragile, TemperatureSensitive, Oversized, HighValue. There is no
"unclassify" event in v1.

## Publishing: the transactional outbox

There is no dual write. Every write use case loads the `Product`, applies the
command, saves it guarded by the loaded version and inserts the
already-encoded CloudEvents into `outbox_events` in one unit of work. The
encoder mints the CloudEvents `id` once, at encode time, so a relay retry
republishes the same id. The relay in `cmd/api` drains every
`OUTBOX_RELAY_INTERVAL` (default `1s`), claims rows `FOR UPDATE SKIP LOCKED`,
sends them one at a time in id order and stops at the first failure, so a
later event of a SKU never overtakes an earlier one. `EVENT_PUBLISHER=kafka|log`
selects the sink (default `log`, which only logs each message).

## Who consumes `ProductClassified`

All four consumers replaced their live `GET /products/{sku}/classification`
calls to `inventory-storage` with a local copy fed by this topic. None of them
calls `product-master` at request time.

| Consumer | Consumer group env | Mode switch | What the local copy is for | Its ADR |
| --- | --- | --- | --- | --- |
| `inventory-storage` | `PRODUCT_MASTER_CONSUMER_GROUP` (unset = not started) | none | its existing `product_classifications` table, read by `StowStock` for placement and same-bin DOT segregation | 0034 |
| `order-management` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default); `http` is rejected at boot | intake enrichment: derived product attributes for path eligibility routing | 0036 |
| `wes-work-planning` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default) | release-time capabilities and the fragile flag | 0035 |
| `fulfillment-execution` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default); `http` is rejected at boot | seal-time package segregation | 0039 |

**Consumer rule.** Keep one row per SKU with the classification and its
`version`; apply a message only when its `version` is greater than the stored
one (insert when absent). Redelivery, replay and out-of-order delivery are
then harmless. Payloads are full state per concern, so a consumer overwrites,
it never merges. The fleet consumer rules apply as everywhere: dispatch on
the **full** `type`, ignore unknown types, dedupe on the CloudEvents `id` in
the same transaction as the effect, commit the offset only after success.

## Consuming: the legacy importer (migration only)

| Item | Value |
| --- | --- |
| Topic | `warehouse.inventory.events` |
| Type | `com.warehouse.wms.inventory-storage.product.ProductClassified`, byte-identical to inventory-storage's AsyncAPI |
| Consumer group | env `LEGACY_IMPORT_CONSUMER_GROUP`; unset = importer not started |
| Effect | `ImportLegacyClassification`: register an unknown SKU and set its classification with source `legacy-import`; skip when the current classification is `native`; no change when identical |
| Idempotency | claim of the CloudEvents `id` in `processed_events` (consumer `legacy-classification-importer`) in the same unit of work as the effect |
| Invalid input | not a CloudEvent, another type, malformed payload, invalid SKU or classification: WARN and commit past |
| Transient failure | retry the same message, 200 ms doubling to 5 s, until it succeeds; no dead-letter topic |

`FetchMessage`, handle, then `CommitMessages`. Every accepted import raises
product-master's own `ProductRegistered` and/or `ProductClassified` through
the outbox, so downstream copies fill from one topic only. On
`inventory-storage`'s `develop` the legacy type is emitted only by its one-shot
backfill command until stage E.

## Machine-generated reference

For the complete generated reference with every payload schema, see the
[AsyncAPI reference](/api-reference/async/product-master), generated from
[`apis/asyncapi.yaml`](https://github.com/IQVO/product-master/blob/develop/apis/asyncapi.yaml)
(a verbatim copy lives at `apis/product-master/asyncapi.yaml` in this
repository). See [Domain Events](/contexts/product-master/domain-events) for
what each event means, and the service's own
[Runtime and integration mechanics](https://github.com/IQVO/product-master/blob/develop/docs/docs/overview/runtime.md)
and [Downstream consumers](https://github.com/IQVO/product-master/blob/develop/docs/docs/ecosystem/downstream-consumers.md)
pages for the code evidence.
