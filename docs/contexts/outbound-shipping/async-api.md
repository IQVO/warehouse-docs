---
id: async-api
title: Async API
sidebar_label: Async API
description: "Kafka integration for outbound-shipping — one published integration topic plus its analytics twin (thirteen event types) through the transactional outbox, five consumed sibling topics (nine types), dead-lettering and the CloudEvents envelope."
---

# Async API

This page is written here from `apis/asyncapi.yaml` (AsyncAPI 2.6), the
relay and event sink in `internal/adapters/outbound/` and the consumers in
`internal/adapters/inbound/kafka/` on `outbound-shipping`'s `develop`
(`fea067b`; the deployment status below was re-checked on 2026-11-13). The machine-generated reference is at the bottom. For per-event
payloads and the raising use cases, see
[Domain Events](/contexts/outbound-shipping/domain-events).

:::info[Applied to k3s, running v0.1.0]
`outbound-shipping` is released as `v0.1.0` (2026-11-11), its Helm chart is merged,
`warehouse-infra` `develop` (`db829ff`) registers it and pins its image
(PR 205: `terraform/apps.yaml`, `helm-values/outbound-shipping.yaml` with the six
consumer groups, dashboards, alert rules), and it was applied to the k3s cluster
on 2026-11-12: one `api` replica runs at `857edfd-arm64`, the seven topics were
pre-created before the first sync and the six consumer groups run (read-only
`kubectl`, re-read 2026-11-13). An edge is live only where both ends run: the
five inbound feeds, the analytics fold and `exception-management`'s consumer
(its live ConfigMap carries `OUTBOUND_SHIPPING_EXCEPTIONS_CONSUMER_GROUP`) are
live; `order-management`'s consumer stays dark (no `OUTBOUND_SHIPPING_*`
variable is set for it), `network-fulfillment`'s has run since the v2.0.4
roll of 2026-11-14 (its group holds all eight partitions of the topic), and
`yard-management` still has no handler, although ADR 0004 and ADR 0005
name it.

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.outbound-shipping.events` | **Published** | Thirteen types from the three aggregates, written by the transactional outbox relay. Key = the aggregate id (`load_id`, `package_id` or `bol_number`). |
| `warehouse.outbound-shipping.analytics` | **Published** (own projector) | The same thirteen occurrences again (same `type`, `id`, `subject`, key and payload; the `dataschema` stream segment is `analytics`). Not an integration contract: the only reader is this service's own analytics consumer, which folds the `load_board` read model. |
| `warehouse.fulfillment.events` | Consumed | `PackageManifested`, `PackageDiverted`, group from `FULFILLMENT_CONSUMER_GROUP`. |
| `warehouse.process-path-management.events` | Consumed | Only `CPTScheduleChanged`, group from `CPT_CONSUMER_GROUP`. |
| `warehouse.facility.events` | Consumed | `ZoneRegistered`, `LocationSlotRegistered`, group from `LAYOUT_CONSUMER_GROUP`. |
| `warehouse.dock-scheduling.events` | Consumed | Only `DockAppointmentBooked` (outbound appointments), group from `DOCK_CONSUMER_GROUP`. |
| `warehouse.yard-management.events` | Consumed | `TrailerDocked`, `DoorWorkCompleted`, `TrailerDeparted`, group from `YARD_CONSUMER_GROUP`. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, after a transient failure exhausts its retries (five attempts, 200 ms doubling to 5 s), or at once for a payload that can never be applied. |

There is no default for any consumer group: each is a mandatory env var, so a
group id never comes from the pod name.

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/outbound-shipping` |
| `type` | `com.warehouse.wms.outbound-shipping.<entity>.<EventName>`, with entity `outboundload`, `shippingpackage` or `billoflading` |
| `subject` | the aggregate id: `load_id`, `package_id` or `bol_number` |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:outbound-shipping:<events\|analytics>:<EventName>:v1` |
| Kafka key | the subject, so one load, package or bill of lading stays ordered on a partition |

`id` is a UUID minted once per occurrence and stored with the outbox row, so a
relay retry republishes the same `id` and consumers dedupe on it. Every
payload carries the aggregate `version` after the change.

## Publishing: the transactional outbox

Events leave only through the outbox: the aggregate rows and their two
outbox rows per event (integration and analytics) commit in one Postgres
transaction, and a relay inside `cmd/api` drains them to Kafka (rows claimed
`FOR UPDATE SKIP LOCKED`, `RequireAll` acks). The relay runs with
`OUTBOX_INTERVAL_MS` 250, `OUTBOX_BATCH` 100 and `OUTBOX_MAX_ATTEMPTS` 20 (`0` means unlimited); a
row past the cap is excluded from future claims until re-armed by hand.
Delivery is at-least-once with the same `id` on a retry.

## Consuming: plan, attach, confirm, flag

All consumers dispatch on the full `type` and ignore every other type on
their topic. The CloudEvents `id` claim (`processed_events`) and the effect
run in one unit of work, so a redelivery is a no-op. A message that is not a
CloudEvent is skipped. A topic that does not exist yet is retried by the
reader and logged; the service stays ready.

- **Plan:** a `PackageManifested` resolves to a cutoff key through the local
  cutoff schedule copy and plans or joins a load. Without `site_id` (optional
  on the wire, omitted by the producer today) it is ignored (ADR 0003).
- **Attach:** an outbound `DockAppointmentBooked` with a `cpt_id` assigns the
  door; a `TrailerDocked` at that door attaches the trailer and starts
  loading.
- **Confirm:** a `TrailerDeparted` for a `CLOSED` load, with a seal number,
  confirms the shipment, issues the bill of lading and publishes
  `ShipmentConfirmed` (ADR 0002). Without a seal it confirms nothing.
- **Flag:** a departure while the load is still `LOADING` flags every package
  not loaded with `PackageMissedLoad`.
- **Ordering:** topics are independent, so the design tolerates any arrival
  order of the schedule and layout copies and a departure before the close
  (handled, flagged, never confirmed).

The yard-management consumed types (ADR 0006) and the dock-scheduling
type (ADR 0007) are pinned to a copy of the producer's AsyncAPI in
`contracts/` and gated in CI; the other
consumed contracts are mirrored by hand.

## Who reads what it publishes

| Consumer | Types | State on the consumer's `develop` |
| --- | --- | --- |
| `order-management` | `ShipmentConfirmed`, `PackageMissedLoad` | Consumer built (ADR 0051), dark by default: `OUTBOUND_SHIPPING_CONSUMER_MODE=off` unless set to `kafka`, with a mandatory `OUTBOUND_SHIPPING_CONSUMER_GROUP` in that mode. |
| `exception-management` | `PackageMissedLoad` | Consumer built (ADR 0011), group `OUTBOUND_SHIPPING_EXCEPTIONS_CONSUMER_GROUP` with a chart default. |
| `network-fulfillment` | `ShipmentConfirmed` (ADR 0004) | Consumer merged on its `develop` on 2026-11-12 (its PR 165, `shipment_confirmed_consumer.go`, group `OUTBOUND_SHIPPING_CONSUMER_GROUP`) and live since the v2.0.4 roll of 2026-11-14 (image `0292f4a-arm64`; the group holds all eight partitions, broker listing read 2026-11-14, log-end offset 0: no event has flowed yet). |
| `yard-management` | `LoadingStarted`, `LoadClosed`, `LoadReopened` (ADR 0005) | No handler on its `develop`; the AsyncAPI marks the three `pending`. |

The other eight types are analytics-only by design.

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/outbound-shipping) page.
