---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for product-master — one published integration topic with eight types, six local-copy consumers of ProductClassified, seven pack-level local views, the CloudEvents envelope and the version-guarded consumer rule.
---

# Async API

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.product-master.events` | **Published** (this context is the exclusive publisher) | `ProductRegistered`, `ProductDescriptionChanged`, `ProductClassified`, `ProductDimensionsDeclared`, `ProductMeasured`, `ProductPackLevelDeclared`, `ProductPackLevelMeasured`, `ProductPackLevelRetired` | **Live** (wired in `warehouse-infra` `develop`). `ProductClassified`: six local copies (`inventory-storage` ADR 0034, `order-management` ADR 0036, `wes-work-planning` ADR 0035, `fulfillment-execution` ADR 0039, `slotting-optimization`, `returns-processing`). Pack levels (ADR 0011): seven local views (`inbound-receiving`, `inventory-storage`, `pick-face-replenishment`, `slotting-optimization`, `wes-work-planning`, `fulfillment-execution`, `network-inventory-planning`; `ProductPackLevelMeasured` only `wes-work-planning` and `slotting-optimization`). `ProductRegistered`: `inbound-receiving`. `ProductDimensionsDeclared`, `ProductMeasured`: `slotting-optimization`. `ProductDescriptionChanged` has no consumer |
| `warehouse.product-master.analytics` | **Published**, consumed only by this service's own `product-projector` | five types (the pack-level events are integration-only), same CloudEvents `id`, `dataschema` `urn:warehouse:product-master:analytics:<EventName>:v1` | **Live**. Written in the same outbox transaction as the integration topic; poison messages go to `warehouse.product-master.analytics.dlq` ([ADR 0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md)) |

The analytics topic is an internal data product of this context, like every
sibling's `warehouse.<ctx>.analytics`: no other context reads it.

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
| `ProductRegistered` | `PUT /products/{sku}` for a new SKU | `sku`, `description`, `version` (always 1) |
| `ProductDescriptionChanged` | `PUT /products/{sku}` with a different description | `sku`, `description`, `version` |
| `ProductClassified` | `PUT /products/{sku}/classification` | `sku`, `handling_tags[]`, `temperature_class`?, `dot_hazard_class`?, `classification_source`, `version` |
| `ProductDimensionsDeclared` | `PUT /products/{sku}/dimensions/declared` | full physical profile: `sku`, `declared`?, `measured`?, `effective`?, `effective_source`, `discrepancy`, `version` |
| `ProductMeasured` | `PUT /products/{sku}/dimensions/measured` | the same full physical profile |
| `ProductPackLevelDeclared` | `PUT /products/{sku}/pack-levels/{level}` (ADR 0011) | the declared pack level with its GTIN; see the [generated reference](/api-reference/async/product-master) |
| `ProductPackLevelMeasured` | `PUT /products/{sku}/pack-levels/{level}/measured` | the measured pack level; see the generated reference |
| `ProductPackLevelRetired` | `POST /products/{sku}/pack-levels/{level}:retire` | the retired pack level; see the generated reference |

`GET /gtins/{gtin}` resolves a GTIN to its SKU and pack level without an event. `?` marks a field omitted when unset. `handling_tags` is in the stable order
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
selects the sink (default `log`, which only logs each message; `warehouse-infra` sets `kafka`).

## Who consumes `ProductClassified`

Six contexts keep a local copy fed by this topic; none of them calls
`product-master` at request time. The first four replaced their former
`GET /products/{sku}/classification` calls to `inventory-storage`
(stages C and D of ADR 0003). Every consumer group below is set in
`warehouse-infra` `develop` (`helm-values/<consumer>.yaml`, or the consumer
chart's default).

| Consumer | Consumer group env | Mode switch | What the local copy is for | Its ADR |
| --- | --- | --- | --- | --- |
| `inventory-storage` | `PRODUCT_MASTER_CONSUMER_GROUP` (unset = not started; `inventory-storage-product-master` in the reference deployment) | none | its existing `product_classifications` table, read by `StowStock` for placement and same-bin DOT segregation | 0034 |
| `order-management` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` (`order-management-product-classification`) | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default); `http` is rejected at boot | intake enrichment: derived product attributes for path eligibility routing | 0036 |
| `wes-work-planning` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` (`wes-work-planning-product-classification`) | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default); `http` is rejected at boot | release-time capabilities and the fragile flag | 0035 |
| `fulfillment-execution` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` (`fulfillment-execution-product-classification`) | `PRODUCT_CLASSIFICATION_MODE=kafka` or `permissive` (default); `http` is rejected at boot | seal-time package segregation | 0039 |
| `slotting-optimization` | `PRODUCT_CONSUMER_GROUP` (`slotting-optimization-product`) | `PRODUCT_MODE` (default `kafka`; also reads `ProductDimensionsDeclared` and `ProductMeasured`) | the `product_profiles` copy behind slot fit | its 0003 |
| `returns-processing` | `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` (`returns-processing-product-classification`, required) | none, always on | the disposition decision (`RESTOCK` never for a `DISPOSE`-classified SKU) | its 0003 |

**Consumer rule.** Keep one row per SKU with the classification and its
`version`; apply a message only when its `version` is greater than the stored
one (insert when absent). Redelivery, replay and out-of-order delivery are
then harmless. Payloads are full state per concern, so a consumer overwrites,
it never merges. The fleet consumer rules apply as everywhere: dispatch on
the **full** `type`, ignore unknown types, dedupe on the CloudEvents `id` in
the same transaction as the effect, commit the offset only after success.

## Who consumes the pack levels

ADR 0011's GS1 packaging hierarchy is read by seven contexts, each into its own
local pack view (no live lookup): `inbound-receiving` (carton-level receiving),
`inventory-storage` (sealed cases and break-case), `pick-face-replenishment`
(the pack-derived replenishment multiple), `slotting-optimization` (case-pick
faces), `wes-work-planning`, `fulfillment-execution` (case and each pick scans)
and `network-inventory-planning`. `ProductPackLevelMeasured` is read only by
`wes-work-planning` and `slotting-optimization`. Each consumer's group is set in
`warehouse-infra` `develop` or comes from its chart's default (fleet edge K62).

## The retired legacy importer

The migration-only importer of `inventory-storage`'s own `ProductClassified`
(`warehouse.inventory.events`, `LEGACY_IMPORT_CONSUMER_GROUP`) was removed at
stage E of ADR 0003, and `inventory-storage` no longer declares or emits that
type (its PR #218). This context consumes no topic today (fleet edge K21,
retired).

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
