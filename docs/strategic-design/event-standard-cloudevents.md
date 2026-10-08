---
id: event-standard-cloudevents
title: "Event Standard: CloudEvents 1.0 (mandatory)"
sidebar_label: Event Standard (CloudEvents)
description: The fleet-wide, mandatory event envelope — CloudEvents 1.0 structured mode on every Kafka topic — with the subdomain table and the cross-service type catalogue.
---

# Event Standard: CloudEvents 1.0 is the ONLY event envelope

:::danger[Mandatory, fleet-wide]
Every Kafka message any warehouse-systems service produces or consumes —
integration topics `warehouse.<ctx>.events` **and** analytics topics
`warehouse.<ctx>.analytics` — is a CloudEvents 1.0 event in structured
content mode. There is no flat envelope, no dual-write, no dual-read and no
envelope toggle (`EVENT_ENVELOPE_MODE` is gone). Each service repository
records this standard as its own ADR, *"CloudEvents 1.0 as the mandatory
event envelope"* (see the [ADR index](/adr)).
:::

This page is the fleet-level copy of the standard. The per-context
[Async API](/contexts) pages describe each context's own topics and payloads;
the generated [Async API reference](/api-reference) is rendered from each
context's `apis/asyncapi.yaml`.

## Example on the wire

Kafka header `content-type: application/cloudevents+json; charset=UTF-8`
(plus `traceparent`/`tracestate`), key = aggregate id, value:

```json
{
  "specversion": "1.0",
  "id": "1d7e4b90-3c58-4d22-9a6f-8b1c0e5d7a23",
  "source": "/warehouse/wes-work-planning",
  "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
  "subject": "wu-10231",
  "time": "2026-08-21T22:12:30Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
  "data": {
    "path_id": "pick-to-tote",
    "work_unit_id": "wu-10231",
    "cpt": "2026-08-22T02:00:00Z",
    "ref": "order-88421-line-3"
  }
}
```

Status: Accepted, fleet-wide, 2026-09-30. Supersedes every "flat envelope"
(`event_id`/`event_type`/`occurred_at`/`source`/`data`), the analytics
"Envelope v1" (`schema_version`), and the dual-envelope migrations
(fulfillment-execution ADR-0027, wes-work-planning ADR-0021).

## 1. Scope

EVERY message any warehouse-systems service writes to or reads from Kafka is
a CloudEvents 1.0 event. That includes integration topics
(`warehouse.<ctx>.events`) AND internal analytics topics
(`warehouse.<ctx>.analytics`). No exceptions, no coexistence.

- There is NO flat envelope, NO dual-write, NO dual-read, NO
  `EVENT_ENVELOPE_MODE` (or any other envelope toggle). Delete them.
- Publishers emit only CloudEvents. Consumers accept only CloudEvents.

## 2. Encoding: Kafka protocol binding, structured content mode

- Structured mode per the CloudEvents Kafka Protocol Binding: the Kafka
  message VALUE is the JSON event format (`application/cloudevents+json`).
- Every produced message carries Kafka header
  `content-type: application/cloudevents+json; charset=UTF-8`.
- Kafka message KEY is unchanged from each publisher's current
  partition-affinity choice (aggregate id). Keep `kafkago.Hash{}` balancer.
- W3C trace context stays in Kafka headers (`traceparent`/`tracestate`) as
  today. Do NOT duplicate it into CloudEvents extension attributes.
- Build, validate and (un)marshal events with the official SDK event package
  `github.com/cloudevents/sdk-go/v2/event` (latest v2, currently v2.16.2):
  `event.New()`, setters, `e.Validate()`, `json.Marshal(e)` /
  `json.Unmarshal(b, &e)`, `e.DataAs(&payload)`. Do NOT use the sdk-go
  protocol/client packages; transport stays `segmentio/kafka-go`. Do NOT
  hand-roll CloudEvent structs.
- Put the CloudEvents helpers in ONE place per repo:
  `internal/adapters/kafka/cloudevents/` (constants, `New(...)` builder,
  `Decode([]byte) (event.Event, error)` which validates). Publishers and
  consumers both use it.

## 3. Context attributes (all REQUIRED in this fleet)

| attribute         | value |
|-------------------|-------|
| `specversion`     | `1.0` |
| `id`              | UUID v4, minted ONCE per domain event and persisted with the outbox row, so a redelivery carries the same id. `(source, id)` is the consumer idempotency key. |
| `source`          | `/warehouse/<repo-name>` (URI-reference), e.g. `/warehouse/order-management`, `/warehouse/wes-work-planning`. Same for integration and analytics topics. |
| `type`            | `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>` (§4) |
| `subject`         | id of the aggregate instance the event is about (order id, task id, path id, slot code, ...). Never empty. |
| `time`            | the domain event's occurred-at instant, UTC, RFC 3339 |
| `datacontenttype` | `application/json` |
| `dataschema`      | `urn:warehouse:<repo-name>:<stream>:<EventName>:v<N>` where `<stream>` is `events` or `analytics`, `N` starts at 1. Absolute URI (spec requirement). This is what distinguishes the integration payload from the analytics payload of the same occurrence. |

- `data` is the event payload JSON object, byte-for-byte the same payload
  shape each service publishes today (this is an envelope migration; do not
  rename payload fields).
- No custom extension attributes unless an ADR justifies one. Extension names
  must be lowercase `[a-z0-9]`, at most 20 chars. The old analytics
  `schema_version` field is REMOVED (replaced by `dataschema`).

## 4. The `type` attribute

Convention (pre-existing platform standard, unchanged):

```text
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

- all segments lowercase except `<EventName>` (PascalCase, past tense,
  exactly the domain event name).
- `<entity>` = the aggregate that raised it, lowercase, no separators.
- The SAME type is used for the occurrence on both the integration and the
  analytics topic (type names the occurrence; `dataschema` names the shape).
- Versioning: additive payload changes keep the type and dataschema.
  A BREAKING payload change requires a new `dataschema` version AND a new type
  with a `.v2` suffix (e.g. `...order.OrderAllocated.v2`), published as a new
  event, never by mutating the old one.

Subdomain and bounded-context segments (authoritative):

| repo                     | subdomain | bounded-context segment  | source |
|--------------------------|-----------|--------------------------|--------|
| facility-layout          | wms       | facility-layout          | /warehouse/facility-layout |
| inventory-storage        | wms       | inventory-storage        | /warehouse/inventory-storage |
| product-master | wms | product-master | /warehouse/product-master |
| inbound-receiving        | wms       | inbound-receiving        | /warehouse/inbound-receiving |
| slotting-optimization    | wms       | slotting-optimization    | /warehouse/slotting-optimization |
| order-management         | wes       | order-management         | /warehouse/order-management |
| process-path-management  | wes       | process-path-management  | /warehouse/process-path-management |
| warehouse-planning       | wes       | warehouse-planning       | /warehouse/warehouse-planning |
| network-fulfillment      | wes       | network-fulfillment      | /warehouse/network-fulfillment |
| labor-performance        | wes       | labor-performance        | /warehouse/labor-performance |
| workforce-management     | wes       | workforce-management     | /warehouse/workforce-management |
| fulfillment-execution    | wes       | fulfillment-execution    | /warehouse/fulfillment-execution |
| wes-work-planning        | wes       | work-planning            | /warehouse/wes-work-planning |

Entity segments for repos that had no catalogue yet:

- order-management: every `Order*` event → `order`
- process-path-management: `ProcessPath*` → `processpath`; `CPTScheduleChanged` → `cptschedule`
- network-fulfillment: `NetworkOrder*` → `networkorder`
- warehouse-planning: `CapacityPlan*` / `CapacityShortageDetected` / `BottleneckDetected` → `capacityplan`
- labor-performance: `LaborStandardDefined`/`LaborStandardRevised` → `standard`; `TaskPerformanceRecorded` → `performance`
- product-master: every `Product*` event → `product` (product-master ADR 0004)
- inbound-receiving: `ASN*` → `asn`; `DockAppointment*` → `dockappointment`; `Receipt*` → `receipt` (inbound-receiving ADR 0004)
- slotting-optimization: every `SlotPlan*` event → `slotplan` (slotting-optimization ADR 0004)

Repos that already have an AsyncAPI catalogue keep the entity segments
already documented there. Events not yet in a catalogue get the entity of
the aggregate that raises them.

### Cross-service contract: these exact strings are consumed by another repo

Consumers MUST dispatch on the FULL `type` string (never a short name, never
a suffix match) and these must be byte-identical on both sides:

| `type` | consumed by |
| --- | --- |
| `com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered` | inventory-storage, warehouse-planning, inbound-receiving (in progress), slotting-optimization (in progress) |
| `com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned` | inventory-storage, warehouse-planning, inbound-receiving (in progress), slotting-optimization (in progress) |
| `com.warehouse.wms.facility-layout.zone.ZoneRegistered` | inventory-storage, slotting-optimization (in progress) |
| `com.warehouse.wms.inventory-storage.reservation.StockReserved` | wes-work-planning |
| `com.warehouse.wms.inventory-storage.reservation.ReservationRevoked` | wes-work-planning |
| `com.warehouse.wms.inventory-storage.product.ProductClassified` | retiring: backfill-only after inventory-storage ADR 0034, consumed by product-master's legacy importer until stage E |
| `com.warehouse.wms.product-master.product.ProductRegistered` | inbound-receiving (in progress) |
| `com.warehouse.wms.product-master.product.ProductDescriptionChanged` | (published contract; no consumer yet) |
| `com.warehouse.wms.product-master.product.ProductClassified` | inventory-storage, order-management, wes-work-planning, fulfillment-execution (local copies; inventory-storage ADR 0034, order-management ADR 0036, wes-work-planning ADR 0035, fulfillment-execution ADR 0039), slotting-optimization (in progress) |
| `com.warehouse.wms.product-master.product.ProductDimensionsDeclared` | slotting-optimization (in progress) |
| `com.warehouse.wms.product-master.product.ProductMeasured` | slotting-optimization (in progress) |
| `com.warehouse.wms.inbound-receiving.asn.ASNRegistered` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.asn.ASNCancelled` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentBooked` | planned: warehouse-planning inbound-labor demand (not built) |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCheckedIn` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCancelled` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCompleted` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.receipt.ReceiptOpened` | (published contract; no consumer yet) |
| `com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived` | inventory-storage (in progress; inventory-storage handover ADR) |
| `com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed` | (published contract; no consumer yet) |
| `com.warehouse.wms.slotting-optimization.slotplan.SlotPlanGenerated` | (published contract; no consumer yet) |
| `com.warehouse.wms.slotting-optimization.slotplan.SlotPlanApproved` | planned: MOVE work execution (not built); read by warehouse-ops-agent and the console |
| `com.warehouse.wms.slotting-optimization.slotplan.SlotPlanRejected` | (published contract; no consumer yet) |
| `com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged` | slotting-optimization (in progress) |
| `com.warehouse.wes.order-management.order.OrderAllocated` | wes-work-planning |
| `com.warehouse.wes.order-management.order.OrderPartiallyAllocated` | wes-work-planning |
| `com.warehouse.wes.order-management.order.OrderRepromised` | (published contract) |
| `com.warehouse.wes.process-path-management.processpath.ProcessPathCreated` | fulfillment-execution, wes-work-planning, workforce-management, order-management |
| `com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated` | same four |
| `com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated` | same four |
| `com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged` | order-management |
| `com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded` | workforce-management (and labor-performance itself) |
| `com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted` | wes-work-planning, warehouse-planning |
| `com.warehouse.wes.fulfillment-execution.task.TaskCompleted` | wes-work-planning, labor-performance |
| `com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed` | order-management |
| `com.warehouse.wes.fulfillment-execution.package.PackageManifested` | order-management |
| `com.warehouse.wes.work-planning.workunit.WorkReleased` | fulfillment-execution |
| `com.warehouse.wes.work-planning.workpool.PathCapacityChanged` | order-management |
| `com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanCreated` | (published contract; no live consumer — order-management is planned / in progress) |
| `com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished` | (published contract; no live consumer — order-management is planned / in progress) |
| `com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected` | (published contract; no live consumer — order-management is planned / in progress) |
| `com.warehouse.wes.warehouse-planning.capacityplan.BottleneckDetected` | (published contract; no live consumer — order-management is planned / in progress) |

## 5. Consumer rules

1. Decode with the SDK and `Validate()`. A message that is not a valid
   CloudEvents 1.0 event (missing `specversion`, legacy flat shape, bad JSON)
   is a deterministic poison message: send it to the repo's existing DLQ path
   if the consumer has one, otherwise log at WARN with topic/partition/offset
   and commit past it. NEVER crash, NEVER block the partition, NEVER fall back
   to parsing a flat envelope.
2. Dispatch on full `type`. Unknown types are ignored silently (forward
   compatibility), not errors.
3. Idempotency/dedupe keys use the CloudEvents `id` (existing
   processed-event tables keep their column, now populated from `id`).
4. Read `time`/`subject` from the context attributes, payload from
   `DataAs`.

## 6. Tests (required)

- Golden-file / exact-JSON unit test per published event type asserting all
  §3 attributes, the type string, and the `content-type` header.
- A test that a legacy flat-envelope message is rejected (DLQ/skip) by every
  consumer, not parsed.
- Existing Kafka integration tests (testcontainers, never skip-gated, never
  hardcoded localhost:9092) updated to the CloudEvents wire format.
- Repo's full local gate green (`make check` / lefthook pre-push).

## 7. Documentation (required)

- `apis/asyncapi.yaml`: `defaultContentType: application/cloudevents+json`,
  one CloudEvents envelope schema with every §3 attribute required, every
  message has its exact `type` const and `dataschema`. Remove flat-envelope
  schemas and any "planned/ahead of the wire" caveats.
- New ADR "CloudEvents 1.0 as the mandatory event envelope" (next number in
  the repo's sequence) stating this standard; mark older envelope ADRs
  (fe 0027, wes 0021, and any ADR describing the flat envelope) as
  "Superseded by ADR-NNNN". Register it in the ADR index/sidebar.
- README / docs pages / .claude/rules / .claude/skills that show the flat
  envelope are rewritten to the CloudEvents shape.
- CLAUDE.md and AGENTS.md carry the mandatory rule section (see
  CLAUDE-SECTION.md, verbatim, with the repo's own row filled in).

## 8. Cutover (no coexistence)

All service PRs merge and deploy as ONE set. Before deploying: drain each
service's outbox (rows were pre-encoded in the flat shape), then delete and
recreate the `warehouse.*.events` and `warehouse.*.analytics` topics and
re-seed the process-path catalogue, so no flat message remains for a
FirstOffset replay. See warehouse-infra [`docs/cloudevents-cutover.md`](https://github.com/IQVO/warehouse-infra/blob/develop/docs/cloudevents-cutover.md).
