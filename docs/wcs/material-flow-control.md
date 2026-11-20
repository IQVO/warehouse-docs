---
id: material-flow-control
title: material-flow-control
sidebar_label: material-flow-control
description: The WES-facing WCS bounded context (Supporting) - transport orders, container physical tracking, station sequencing, clarification and the subsystem capacity view. Designed, not built.
---

{/* drift-allow-file: the WCS tier is designed, not built; every route on this page is a design proposal with no OpenAPI on develop yet */}

# material-flow-control

:::note[Designed, not built]
Classification **Supporting**. CloudEvents segment `wes`. Topics
`warehouse.material-flow-control.events` and `.analytics`. No repository exists
yet.
:::

## Purpose

Turn a WES transport request into a completed physical move of a container
across the automated subsystems, and be the one source of truth for **where each
container physically is** inside the automation. It is the material flow
controller of the sources, the "specialized on-the-ground traffic controller"
between the host and the subsystems (see the
[industry reference](/wcs/industry-reference#the-layers-internal-structure)).

## Business capabilities

| Capability | What it does |
| --- | --- |
| Transport order management | Accepts or rejects a request, splits it into legs through handoff points (for example AS/RS port, then AMR, then station) and tracks it to exactly one outcome. |
| Container tracking | Keeps each container's physical position: in the AS/RS, at an AS/RS port, on a robot, at a station, at a dock or at a clarification point. |
| Station sequencing | Orders arrivals at each goods-to-person station by priority and due time, and holds the station buffer limit. |
| Clarification and exceptions | Handles unknown or mismatched containers, failed legs and retries; sends a container to a clarification point and raises an anomaly. |
| Subsystem capacity | Aggregates the state and capacity facts of `amr-fleet-control` and `asrs-control` into the capacity view the WES consumes. |

## Responsibilities (what it must guarantee)

1. A container has **at most one active transport order**.
2. A leg starts **only after** the previous leg's handoff is confirmed by the
   subsystem that holds the container.
3. A station queue **never exceeds** its configured buffer, and arrivals follow
   the requested priority, then the due time.
4. A container at a clarification point is **never dispatched** until it is
   resolved.
5. Every accepted request ends in **exactly one** of `Completed` or `Failed`,
   and a failure carries a reason code.
6. A request is **idempotent** on its `transportRequestId`: a retried request
   returns the original outcome and creates no second order.

## What it does not own

| Concern | Owner |
| --- | --- |
| What is in a container, and the stock ledger | `inventory-storage` |
| Which container moves, and when work is released | `fulfillment-execution`, `wes-work-planning` |
| The destination of a move | The WES request; the WCS chooses only the route |
| Robot paths, traffic, deadlocks and charging | `amr-fleet-control` |
| Rack positions and shuttle and lift scheduling | `asrs-control` |
| The anomaly lifecycle once raised | `exception-management` |

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| **TransportRequest** | The WES's request to move one container: source, destination, purpose, priority, due. Identified by `transportRequestId`. |
| **TransportOrder** | This context's accepted plan for one request: a sequence of legs and one outcome. Not a customer order and not a VDA 5050 order. |
| **Leg** | One move inside one subsystem, from one handoff point to the next. |
| **HandoffPoint** | A place where a container passes from one subsystem to another: an AS/RS port, an AMR pickup or drop node at a station or a dock. |
| **ContainerTrack** | The physical position of one container and its history inside the automation. |
| **StationQueue** | The ordered arrivals and the buffer limit of one goods-to-person station. |
| **ClarificationPoint** | Where a container goes when it cannot be identified or does not match its order (SAP EWM's term). |
| **Purpose** | Why a container moves: `PICK`, `PUTAWAY`, `REPLENISH`, `OUTBOUND` or `RETURN`. |
| **Subsystem** | One equipment system under this context: the AMR fleet or the AS/RS. |

## Candidate aggregates

| Aggregate | Invariants it protects |
| --- | --- |
| `TransportOrder` | 2, 5, 6: legs in order, one outcome, idempotency |
| `ContainerTrack` | 1, 4: one active order per container, no dispatch while in clarification |
| `StationQueue` | 3: buffer limit and arrival order |

To be confirmed in the Define and Code steps with the Aggregate Design Canvas.

## Inbound communication

| From | Message | Channel |
| --- | --- | --- |
| `fulfillment-execution` | `POST /transport-requests`; `POST /transport-requests/{id}/cancellation` | REST, `Idempotency-Key` |
| `amr-fleet-control` | `LegAssigned`, `LegCompleted`, `LegFailed`, `FleetCapacityChanged` | Kafka |
| `asrs-control` | `ContainerStored`, `ContainerPresentedAtPort`, `StorageJobFailed`, `EquipmentStateChanged`, `AsrsCapacityChanged` | Kafka |

## Outbound communication

| To | Message | Channel |
| --- | --- | --- |
| `amr-fleet-control` | Request a leg; cancel a leg | REST |
| `asrs-control` | Request a store or a retrieve job; cancel a job | REST |
| `fulfillment-execution` | `TransportAccepted`, `TransportRejected`, `ContainerArrivedAtStation`, `TransportCompleted`, `TransportFailed` | Kafka |
| `wes-work-planning` | `SubsystemCapacityChanged` | Kafka |
| `exception-management` | `ContainerSentToClarification` | Kafka |

Event types follow the Event Standard, for example
`com.warehouse.wes.material-flow-control.transport.ContainerArrivedAtStation`
with `subject` set to the transport order id.
