---
id: seam-decisions
title: WCS seam decisions
sidebar_label: Seam decisions
description: The five decisions at the seams between the WCS and the fleet - container ownership, the AS/RS as one logical location, the WES-WCS transport contract, the transport purposes and the CloudEvents segment - with the options considered and the rationale.
---

{/* drift-allow-file: strategic design page, not a spec mirror - the built contexts' authoritative contracts are each repository's apis/openapi.yaml and apis/asyncapi.yaml on develop */}

# WCS seam decisions

Each decision below was taken during the strategic design (2026-11-19). Each one
will be recorded as an ADR in the repository that owns it during the
implementation phase (see [ecosystem impact](/wcs/ecosystem-impact#adrs-to-write)).

## Decision 1: the container belongs to the WMS

**Context.** No context owns the identity of a container today.
`fulfillment-execution`'s ubiquitous language lists **Tote** as "implicit in the
Pick path narrative", and `inventory-storage` mentions a lost tote only as a
failure. The WCS moves containers, so someone must issue and own their identity.

| Option | Verdict |
| --- | --- |
| **A. `inventory-storage` owns `Container`** (the license plate or handling unit): its id, its contents and its logical location. The WCS references the id only. | **Chosen.** This is how WMS products work: SAP EWM's handling units live on the WMS side and its material flow system addresses them by id. Contents are stock, and stock has one writer. |
| B. A new `container-management` context | Rejected (YAGNI): a service of its own for a small part of the stock ledger. |
| C. The WCS owns container ids | Rejected: to answer "which tote holds SKU X" it would need contents, and the WCS must never know contents. |

**Consequences.** `inventory-storage` gains a `Container`, holds stock per
container, and returns a container id when allocation targets automated storage.
This is the largest change the design asks of an existing context. The WCS keeps
only `containerId` and the container's physical position.

## Decision 2: the AS/RS is one logical location

**Context.** The WMS needs to say where stock is; the AS/RS moves containers
between rack positions on its own (reshuffles, re-slotting).

**Decision.** `facility-layout` gains a `LocationType` `AutomatedStorage` with the
role `Storage`. Each AS/RS is **one logical location** with an ordinary
`LocationCode`. `inventory-storage` records that container C, with its contents,
is in that location. Rack positions stay inside `asrs-control`.

**Rationale.** KNAPP: a WMS "is decoupled from the actual execution" (see the
[fleet industry reference](/wms-wes/industry-reference)). If the ledger held rack
positions, every reshuffle would be a stock transaction.

**Consequences.** Internal AS/RS moves never touch the ledger. A container out
of the AS/RS on a goods-to-person trip keeps its logical location in the AS/RS;
its physical position is known to `material-flow-control` only. The stock moves
logically only when a task completes (a pick, a stow, a replenishment).

## Decision 3: the WES-WCS transport contract

`fulfillment-execution`'s `EquipmentCommandPort` adapter calls
`POST /transport-requests` with an `Idempotency-Key`:

| Field | Meaning |
| --- | --- |
| `transportRequestId` | Idempotency and correlation key, derived from the task id. |
| `containerId` | The `inventory-storage` container id. |
| `source` | A `LocationCode`, or the AS/RS logical location. |
| `destination` | A station id (goods-to-person) or a `LocationCode` (pack station, dock door, AS/RS input, forward-area handoff). |
| `purpose` | One of the transport purposes ([decision 4](#decision-4-five-transport-purposes)). |
| `priority`, `dueBy` | The WES priority band and a deadline derived from the CPT. |

| Response | Meaning |
| --- | --- |
| `202 Accepted` | With a `transportOrderId`. Progress follows as events. |
| `422` problem+json | Rejected, with a reason: `UNKNOWN_CONTAINER`, `CONTAINER_BUSY`, `DESTINATION_UNREACHABLE`, `SUBSYSTEM_UNAVAILABLE`. |

Cancellation is `POST /transport-requests/{id}/cancellation`, following the
fleet's REST guideline, which retired colon-verb routes. Progress is reported
only through events, never by polling: `TransportAccepted`,
`ContainerArrivedAtStation`, `TransportCompleted`, `TransportFailed` (with a
reason: `CLARIFICATION`, `SUBSYSTEM_FAULT`, `CANCELLED`, `TIMEOUT`).

**Rules.** The contract carries no equipment vocabulary: no robot, node,
shuttle, aisle or rack position. The WES chooses the container and the
destination; the WCS chooses the route.

## Decision 4: five transport purposes

`PICK`, `PUTAWAY`, `REPLENISH` and `OUTBOUND` cover the four flows. A fifth,
**`RETURN`**, covers the trip back to storage after goods-to-person picking or a
replenishment. A return is not a putaway: the container's contents and logical
location do not change, so no ledger transaction follows it. Keeping it separate
stops the WES from creating a stow task for a container that never left the
AS/RS logically.

## Decision 5: the CloudEvents segment is `wes`

The three WCS contexts publish with the existing `wes` segment, on their own
topics:

| Context | Topic | Example type |
| --- | --- | --- |
| `material-flow-control` | `warehouse.material-flow-control.events` | `com.warehouse.wes.material-flow-control.transport.ContainerArrivedAtStation` |
| `amr-fleet-control` | `warehouse.amr-fleet-control.events` | `com.warehouse.wes.amr-fleet-control.mission.LegCompleted` |
| `asrs-control` | `warehouse.asrs-control.events` | `com.warehouse.wes.asrs-control.storagejob.ContainerPresentedAtPort` |

Each also has an `.analytics` topic. The
[Event Standard](/strategic-design/event-standard-cloudevents) defines `wes` as
every context that is not one of the `wms` masters or stock keepers, and says the
segment is a contract label, not an industry category. The WCS tier is shown as
its own tier on the [WMS and WES](/wms-wes) pages instead. A visible `wcs`
segment was considered and rejected: it would amend the fleet standard for a
label the standard says carries no meaning.
