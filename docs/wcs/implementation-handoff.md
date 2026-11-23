---
id: implementation-handoff
title: WCS implementation handoff
sidebar_label: Implementation handoff
description: What the next phase needs to build the WCS - the build order, the equipment emulator's scope, acceptance criteria per flow, and the questions left open by the strategic design.
---

{/* drift-allow-file: the WCS tier mixes built (asrs-control) and proposed contexts; routes here are design proposals except where the page says a context is built */}

# WCS implementation handoff

This page hands the strategic design to the implementation phase. The tactical
design of each context (Aggregate Design Canvas, Bounded Context Canvas,
EventStorming board) is produced in each repository, as every fleet context does,
and synced here once the repositories exist.

## Build order

| Step | What | Why this order |
| --- | --- | --- |
| 1 | `equipment-emulator` and the MQTT broker | Nothing else can be tested without robots and an AS/RS to talk to. |
| 2 | `asrs-control` | DONE - built by plan WCS-02, merged to develop 2026-11-20 (IQVO/asrs-control PR #2); it proves the subsystem-controller interface. |
| 3 | `amr-fleet-control` | DONE - built by plan WCS-03, merged to develop 2026-11-22 (IQVO/amr-fleet-control PR #2); plan WCS-06 extended its example floor map with the pick-face, forward and clarification handoff points PK1/FWD1/CLR1 (map `2026-11-22.1`, released v0.1.1, legs verified live 2026-11-23). |
| 4 | `material-flow-control` | DONE - built by plan WCS-04, merged to develop 2026-11-22 (IQVO/material-flow-control PR #2, released v0.1.0); its legs to the PK1/FWD1/CLR1 handoff points were proven end to end by plan WCS-06 (PR #12, live 2026-11-23). |
| 5 | Changes to existing contexts | `inventory-storage`, then `facility-layout`, `fulfillment-execution`, `wes-work-planning`, `exception-management` (see [ecosystem impact](/wcs/ecosystem-impact)). |
| 6 | Flows end to end | Goods-to-person, then putaway, replenishment and outbound. |

## Emulator scope

The emulator stands in for levels 1 and 0. It is test infrastructure, not a
bounded context, and it holds no business rule.

- **Robots.** Implements the robot side of VDA 5050 v3: subscribes to `order`
  and `instantActions`, publishes `state`, `connection` and `factsheet`, moves
  along the released base at a configured speed, and reports battery.
- **AS/RS.** Implements the PLC side of the fleet telegram protocol: shuttles
  per level, lifts per aisle, move durations, and a handshake on every
  telegram.
- **A simulation clock** that can run faster than real time, so that end-to-end
  tests of a full shift finish in minutes.
- **Fault injection**: a blocked robot, a low battery, a lost connection, a
  shuttle fault, a no-read at a port. Every row of the
  [failure path](/wcs/message-flows#the-failure-path) must be reproducible.
- **Seeded from the fleet**: the robot map from `facility-layout`'s travel graph
  and the AS/RS layout from configuration.

## Acceptance criteria per flow

| Flow | Given | When | Then |
| --- | --- | --- | --- |
| Goods-to-person | Container C in the AS/RS, a free station S | `fulfillment-execution` requests C to S with `PICK` | `ContainerArrivedAtStation` for S; the task becomes claimable; after `TaskCompleted` and a `RETURN`, `ContainerStored` follows and no stock transaction is written for the return. |
| Putaway | Container C filled at a decant station | A `PUTAWAY` request to the AS/RS | `ContainerStored`, then `TransportCompleted`; after `TaskCompleted`, `inventory-storage` shows C's contents in the AS/RS location. |
| Replenishment | A replenishment request for a forward pick face | A `REPLENISH` request for the source container | `TransportCompleted` at the forward handoff; after `TaskCompleted` the stock moves by the existing RELOCATE fields; a `RETURN` brings C back. |
| Outbound | Order tote O complete at a station | An `OUTBOUND` request to a pack station | `TransportCompleted`; the pack task becomes claimable. |
| Rejection | Container C already has an active transport | A second request for C | `422` with `CONTAINER_BUSY`; no second transport order. |
| Idempotency | An accepted request | The same `transportRequestId` is retried | The original outcome is returned; one transport order exists. |
| Clarification | A no-read is injected at a port | Any request through that port | `ContainerSentToClarification`, a case in `exception-management`, `TransportFailed` with `CLARIFICATION`. |
| Capacity loop | The emulator drops half the robots offline | Within one capacity interval | `SubsystemCapacityChanged` reflects it, and `wes-work-planning` releases less goods-to-person work. |

## Open questions

| Question | Who decides | Notes |
| --- | --- | --- |
| The AS/RS telegram protocol | `asrs-control` ADR 0001 | No public standard was found; model it on SAP EWM's telegrams and handshake, and keep it small. |
| Container id format and who prints labels | `inventory-storage` ADR | Decision 1 places ownership; the format is open. |
| Who configures station buffer limits | `material-flow-control` ADR 0001 | Either its own configuration or a `facility-layout` station attribute. |
| How capacity is measured | `material-flow-control` and `wes-work-planning` ADRs | For example robots available and retrievals per minute, and the publish interval. |
| VDA 5050 version | `amr-fleet-control` ADR 0001 | This design cites v3.0.0; supporting v2 robots as well is a scope choice. |
| Where container position is shown to people | `warehouse-console` | A floor view is out of this design's scope. |
