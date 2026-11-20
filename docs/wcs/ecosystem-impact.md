---
id: ecosystem-impact
title: WCS ecosystem impact
sidebar_label: Ecosystem impact
description: What the WCS design changes in each existing context, the ADRs to write in each owning repository, and the infrastructure it adds (an MQTT broker, three services and an emulator).
---

{/* drift-allow-file: the WCS tier mixes built (asrs-control) and proposed contexts; routes here are design proposals except where the page says a context is built */}

# WCS ecosystem impact

Every change to an existing context is additive: no route, event or field that
exists today is removed or changes meaning.

## Changes to existing contexts

| Context | Change | Why |
| --- | --- | --- |
| `inventory-storage` | Adds **`Container`** (license plate / handling unit): id, contents, logical location. Holds stock per container. Allocation into automated storage returns a container id. | [Seam decision 1](/wcs/seam-decisions#decision-1-the-container-belongs-to-the-wms). The largest change the design asks of an existing context. |
| `facility-layout` | Adds the **`AutomatedStorage`** `LocationType` with role `Storage`; registers AS/RS ports, stations and dock handoffs as locations. | [Seam decision 2](/wcs/seam-decisions#decision-2-the-asrs-is-one-logical-location); the AMR map is built from its travel graph. |
| `fulfillment-execution` | `EquipmentCommandPort` gains `RequestTransport` and `CancelTransport`, with one outbound adapter to `material-flow-control`. A task gains the **AwaitingContainer** state. A consumer for the transport events. | ADR-0015 reserved this seam for exactly this. |
| `wes-work-planning` | A consumer for `SubsystemCapacityChanged`, through an ACL, as a release constraint. | Automation-aware release ([capacity loop](/wcs/message-flows#the-capacity-loop)). |
| `exception-management` | Consumes the WCS anomaly events as a new producer. | It already conforms to every producer it consumes. |
| `warehouse-ops-agent`, `warehouse-console` | Read-only views of equipment state and container position. | The existing read pattern. |

Contexts that do not change: `order-management`, `inbound-receiving`,
`pick-face-replenishment`, `product-master`, `slotting-optimization` and the rest.
Their flows reach the WCS only through `fulfillment-execution`.

## ADRs to write

Each in its owning repository during the implementation phase; the
[ADR index](/adr) will link to them.

| Repository | ADR |
| --- | --- |
| `material-flow-control`, `amr-fleet-control`, `asrs-control` | ADR 0001 creating the context (purpose, classification, boundaries from this design) and the CloudEvents ADR every Kafka-using repo carries. |
| `fulfillment-execution` | Amends ADR-0015: the seam's first methods, its adapter, and the AwaitingContainer state. |
| `inventory-storage` | `Container`, stock per container, container-aware allocation. |
| `facility-layout` | The `AutomatedStorage` location type. |
| `wes-work-planning` | Subsystem capacity as a release constraint. |
| `exception-management` | The WCS contexts as anomaly producers. |
| `warehouse-infra` | The MQTT broker, the three applications and the emulator. |

## Infrastructure

| Addition | Where | Notes |
| --- | --- | --- |
| MQTT broker (Eclipse Mosquitto) | `warehouse-infra` `10-platform` | Carries VDA 5050 and the AS/RS telegrams inside the WCS only. Not a second integration bus: nothing outside the WCS subscribes to it. |
| Three services | One repository each, each with its own Helm chart, registered in `warehouse-infra`'s application registry | The fleet's standard shape: Go, hexagonal, arch-go fitness tests, OpenAPI and AsyncAPI, CloudEvents with an outbox. |
| `equipment-emulator` | Its own repository and chart | Test infrastructure at levels 1 and 0, not a bounded context (see the [handoff](/wcs/implementation-handoff#emulator-scope)). |
| Topics | Kafka | `warehouse.material-flow-control.events`, `warehouse.amr-fleet-control.events`, `warehouse.asrs-control.events`, each with `.analytics`. |

## What does not change

- The 2026-09-15 boundary rule holds: the WMS decides release eligibility, the
  WES decides timing and composition. The WCS adds the "how" below both and
  decides neither.
- The WCS never writes the stock ledger and never releases work.
- The fleet's WES stays an embedded WES that sits above the WCS; it becomes
  automation-aware without driving equipment.
- REST stays unauthenticated fleet-wide, by deliberate decision.
