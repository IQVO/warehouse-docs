---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: network-fulfillment has no typed domain events and no Kafka topic yet — the log-only EventPublisher port, the events ADR 0001 plans, and the rules that apply when Kafka arrives.
---

# Domain Events

:::info[No domain events, no Kafka — yet]
`network-fulfillment` **defines no typed domain events and neither
publishes to nor consumes from Kafka.** There is no Kafka client, topic
or consumer group in the code, and therefore no AsyncAPI reference for
this context. Everything it does with the fleet today is synchronous REST
to `order-management`.
:::

## What exists: a log-only publisher port

`ports.EventPublisher` (`Publish(ctx, event)`) is declared in
`internal/application/ports/ports.go`, and both use cases
(`ReceiveNetworkDemand`, `SweepAcknowledgementDeadlines`) carry it as a
dependency. `cmd/netfulfil` wires it to a `logPublisher` that only writes a
structured log line — and **no use case calls `Publish`**. It is a seam
for later, not a live integration.

## What ADR 0001 plans (not built)

| Planned event / flow | Direction | Source in [ADR 0001](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md) |
| --- | --- | --- |
| **AcknowledgementDeadlineAtRisk** | Raised by a sweep for orders *approaching* `acknowledgeBy` without an answer — a reported fact, not a state transition, deliberately re-fired each pass while still true | §6 (the implemented sweep instead rejects orders *past* the deadline) |
| Consume inventory availability, `CPTScheduleChanged` (`process-path-management`), `PathCapacityChanged` (`wes-work-planning`) | Inbound, into three local caches feeding `CapabilityOffer` | §8 |
| Consume `PackageManifested` (`fulfillment-execution`) | Inbound, to drive shipment confirmation back to the network (the `idx_network_orders_local_order` index already exists for this reverse lookup) | Rollout step 6 |
| Publish outward | "Publishing comes later" (`.claude/rules/integration-events.md`) | — |

`CapabilityOffer` itself is published **to the network** (as an inventory
update), not onto the fleet's Kafka bus.

## Rules for when Kafka arrives

From the repository's `.claude/rules/integration-events.md`:

- One broker for the whole fleet; topic naming
  `warehouse.<context>.events`; CloudEvents-style envelopes with
  `com.warehouse.<subdomain>.network-fulfillment.<entity>.<EventName>`
  types.
- **Nothing network-shaped crosses into a published event** — no
  purchase-order numbers as fleet identities, no ASINs, no network status
  codes, and no customer PII.
- Consumer group ids must be env-configurable, never inline literals
  (`TestKafkaConsumerGroupNeverHardcodedInline`); a consumer that replays
  from the first offset to build an in-memory cache must use a group id
  **unique per process instance** (hostname+PID+timestamp).
- Kafka integration tests must start their own broker via testcontainers
  (`TestKafkaIntegrationTestsUseTestcontainers`) — CI provides no broker.
- Add `apis/asyncapi.yaml` in the same PR.

See the [Bounded Context Canvas](/contexts/network-fulfillment/bounded-context-canvas)
for the live synchronous edges.
