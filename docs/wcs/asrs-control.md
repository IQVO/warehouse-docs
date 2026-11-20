---
id: asrs-control
title: asrs-control
sidebar_label: asrs-control
description: The AS/RS controller bounded context (Generic) - rack position assignment, shuttle and lift job scheduling, port presentation, reshuffles and equipment state. Built on develop (IQVO/asrs-control).
---

{/* drift-allow-file: strategic design page, not a spec mirror - the built context's authoritative contracts are IQVO/asrs-control apis/openapi.yaml and apis/asyncapi.yaml on develop */}

# asrs-control

:::note[Built - IQVO/asrs-control on develop]
Classification **Generic**: AS/RS controllers ship with the hardware; this one is
built behind the subsystem-controller interface so a vendor controller could
replace it. CloudEvents segment `wes`. Topics `warehouse.asrs-control.events`
and `.analytics`. Speaks a fleet-defined telegram protocol over MQTT to the
emulated shuttles and lifts. Repository: [IQVO/asrs-control](https://github.com/IQVO/asrs-control), merged 2026-11-20 (plan WCS-02, PR #2): OpenAPI and AsyncAPI contracts, telegram protocol v1 over MQTT, CloudEvents on warehouse.asrs-control.events and .analytics.
:::

## Purpose

Store and retrieve containers in the automated storage and retrieval system at
the throughput the WCS needs, and own **where each container sits inside the
rack**. To the WMS the whole AS/RS is one logical location (see
[seam decision 2](/wcs/seam-decisions#decision-2-the-asrs-is-one-logical-location)).

## Business capabilities

| Capability | What it does |
| --- | --- |
| Storage position assignment | Chooses the rack position for a stored container by velocity zone, with depth rules for double-deep racks. |
| Job scheduling | Sequences store and retrieve jobs across shuttles and lifts, balancing load across aisles. |
| Port presentation | Presents retrieved containers at output ports in the requested sequence. |
| Reshuffles | Moves a blocking front container out of the way in a double-deep rack. |
| Equipment state | Tracks each shuttle and lift's PackML-style state (Idle, Execute, Held, Suspended, Stopped, Aborted) and faults. |

## Responsibilities (what it must guarantee)

1. **One container per rack position**, and every stored container is in
   **exactly one** position.
2. A position is **never assigned** while it is reserved.
3. A shuttle or lift runs **one job at a time**.
4. Retrieved containers reach each output port **in the requested sequence**.
5. Every accepted job ends in **exactly one** of done or `StorageJobFailed`,
   with a reason.
6. Internal moves (reshuffles, re-slotting) are **invisible outside**: they
   publish no transport fact and never reach the stock ledger.

## What it does not own

| Concern | Owner |
| --- | --- |
| SKUs and quantities in a container | `inventory-storage` |
| Which container to retrieve, and when | `fulfillment-execution` and `wes-work-planning`, through `material-flow-control` |
| Transport beyond its own ports | `material-flow-control` and `amr-fleet-control` |
| The AS/RS as a location in the building | `facility-layout` (one `AutomatedStorage` location) |

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| **Rack**, **Aisle**, **Level** | The physical structure of the AS/RS. |
| **RackPosition** | One storage position for one container, inside this context only. Not a `LocationCode`. |
| **Shuttle**, **Lift** | The equipment units that move containers along a level and between levels. |
| **StorageJob** | One store or retrieve of one container. |
| **Port** | An input or output point of the AS/RS, and a handoff point for `material-flow-control`. |
| **Reshuffle** | An internal move that unblocks a deeper position. |
| **Telegram** | A message to or from the PLC, with a handshake (SAP EWM's term). |

## Candidate aggregates

| Aggregate | Invariants it protects |
| --- | --- |
| `StorageJob` | 4, 5: sequence at the port, one outcome |
| `StorageMap` (one per aisle) | 1, 2, 6: positions, reservations, internal moves |
| `EquipmentUnit` | 3: one job per shuttle or lift, state |

## Inbound communication

| From | Message | Channel |
| --- | --- | --- |
| `material-flow-control` | Request a store or retrieve job; cancel a job | REST |
| Shuttles and lifts (emulated PLC) | Move confirmations, faults, state | MQTT telegrams with handshake |

## Outbound communication

| To | Message | Channel |
| --- | --- | --- |
| Shuttles and lifts | Move telegrams | MQTT |
| `material-flow-control` | `ContainerStored`, `ContainerPresentedAtPort`, `StorageJobFailed`, `EquipmentStateChanged`, `AsrsCapacityChanged` | Kafka |
| `exception-management` | `StorageJobFailed` with reason `EQUIPMENT_FAULT` | Kafka |
