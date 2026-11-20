---
id: amr-fleet-control
title: amr-fleet-control
sidebar_label: amr-fleet-control
description: The VDA 5050 master control bounded context for the AMR fleet (Generic) - mission assignment, path and traffic control, deadlocks, charging, robot registry and the node-edge map. Designed, not built.
---

{/* drift-allow-file: the WCS tier is designed, not built; every route on this page is a design proposal with no OpenAPI on develop yet */}

# amr-fleet-control

:::note[Designed, not built]
Classification **Generic**: VDA 5050 master control, built to the standard so a
vendor fleet controller could replace it. CloudEvents segment `wes`. Topics
`warehouse.amr-fleet-control.events` and `.analytics`. Speaks VDA 5050 v3 over
MQTT to the robots. No repository exists yet.
:::

## Purpose

Execute transport legs with a fleet of autonomous mobile robots, safely and
without deadlocks. It is the "fleet control system" of VDA 5050, which does
"Assignment of orders to the mobile robots", "Detection and resolution of
blockages ('deadlocks')" and "Traffic control" (see the
[industry reference](/wcs/industry-reference#interface-standards)).

## Business capabilities

| Capability | What it does |
| --- | --- |
| Mission assignment | Chooses a robot for each leg by distance, battery and availability. |
| Path and traffic control | Plans the route on the node and edge map, releases nodes and edges as VDA 5050 *base* and *horizon*, and reserves them so that two robots never hold the same one. |
| Deadlock handling | Detects blockages and resolves them by re-routing or waiting. |
| Charging | Sends robots to charge below a battery threshold and keeps them out of assignment until charged. |
| Robot registry | Tracks each robot's connection, state, errors and factsheet. |
| Map | Keeps the versioned node and edge map, translated through an ACL from `facility-layout`'s travel graph. |

## Responsibilities (what it must guarantee)

1. A robot executes **one order at a time**.
2. A node or edge in a released base is **reserved by exactly one robot**.
3. `orderUpdateId` **only increases** within one order (the VDA 5050 rule).
4. A robot below the charge threshold is **never assigned** a leg.
5. Every mission is **pinned to one map version**.
6. Every accepted leg ends in **exactly one** of `LegCompleted` or `LegFailed`,
   with a reason.

## What it does not own

| Concern | Owner |
| --- | --- |
| Which container moves, why, and where it ends | `material-flow-control`, from the WES request |
| Station sequence and buffers | `material-flow-control` |
| Container contents | `inventory-storage` |
| The building's structure and travel graph | `facility-layout` (this context keeps only its translated copy) |
| The AS/RS | `asrs-control` |

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| **Robot** | One AMR, identified by VDA 5050 `manufacturer` and `serialNumber`. |
| **Mission** | This context's execution of one leg by one robot. |
| **Order** | A VDA 5050 order sent to a robot: a node and edge graph segment, with `orderId` and `orderUpdateId`. Used only inside this context. |
| **Node**, **Edge** | The VDA 5050 map elements, translated from `facility-layout`'s waypoints and edges. |
| **Base**, **Horizon** | The released and the not yet released parts of an order (VDA 5050). |
| **Action** | A VDA 5050 action at a node or edge, for example lift or drop a container. |
| **Factsheet** | A robot's published capabilities (VDA 5050). |
| **ChargingStation** | A node where robots charge. |

## Candidate aggregates

| Aggregate | Invariants it protects |
| --- | --- |
| `Mission` | 3, 5, 6: order updates, map version, one outcome |
| `Robot` | 1, 4: one order, charge threshold |
| `FleetMap` | 2: node and edge reservations within one map version |

## Inbound communication

| From | Message | Channel |
| --- | --- | --- |
| `material-flow-control` | Request a leg; cancel a leg | REST |
| `facility-layout` | Travel graph, station and dock locations | Its existing events and REST reads, through the ACL |
| Robots | `state`, `connection`, `factsheet` | MQTT (VDA 5050) |

## Outbound communication

| To | Message | Channel |
| --- | --- | --- |
| Robots | `order`, `instantActions` | MQTT (VDA 5050) |
| `material-flow-control` | `LegAssigned`, `LegCompleted`, `LegFailed`, `FleetCapacityChanged`, `RobotStateChanged` | Kafka |
| `exception-management` | `DeadlockDetected`, `LegFailed` with reason `ROBOT_BLOCKED` | Kafka |

MQTT topics follow VDA 5050:
`vda5050/v3/<manufacturer>/<serialNumber>/<topic>`.
