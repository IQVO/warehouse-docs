---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the warehouse needs a context for the physical yard: gate, trailer location, hostler moves, door work and dwell, kept apart from the door calendar."
---

# Business Context

:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Built on develop (merged 2026-11-08) in [IQVO/yard-management](https://github.com/IQVO/yard-management), released at v0.1.2 (first release v0.1.0 on 2026-11-09) and applied to the k3s cluster on 2026-11-10 in a reduced footprint: dock-scheduling runs its API only (it relays inline); yard-management runs its API and relay. Their MCP servers, analytics projectors, report services and sweeps are registered in warehouse-infra but switched off until the cluster has room, so the KPI reports of yard-management ADR 0011 are released, not yet served. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

## The problem in plain language

A site has walls, and a lot of its day happens outside them. A tractor and
driver arrive at the **gate**. Some of them have a booked time at a door; some
are walk-ins. The trailer they bring has to go somewhere: straight to a
**dock door**, or to a **parking spot** until a door is free. Someone has to
move it (a yard driver, the **hostler**, or the visiting driver for the first
move). At the door it is unloaded or loaded (**door work**). Afterwards it
leaves the door, waits in a spot, or goes out through the gate with the same
tractor.

The existing contexts keep everything inside the four walls (`meta.organization`
in the model). `facility-layout` registers the `Yard` and `Dock` locations of a
site, but no context records what is physically on them. So nobody can answer,
at a given moment: which trailer is on which spot, which door is free, how long
has that trailer been here, did the seal match what the carrier declared, which
hostler is doing what.

This context answers those questions. It is the **present** of the yard.

## Two contexts, one boundary

| Question | Owner | Why |
| --- | --- | --- |
| Is door 7 booked for carrier X from 10:00 to 11:00 tomorrow? | `dock-scheduling` | Door time in the future; the no-double-booking rule lives there. |
| Is trailer 4471 on spot Y12 right now, and has it been there too long? | `yard-management` | A physical fact in the present; the one-trailer-per-place rule lives here. |

The scope rule in the model: `dock-scheduling` owns the future of a door,
`yard-management` owns the present of the yard, and each keeps an event-fed
local copy of what it needs from the other. Neither calls the other
synchronously. `yard-management` keeps `AppointmentView` and `DoorClosureView`
from `dock-scheduling` events, and `dock-scheduling` applies arrival, docking
and door release from `yard-management` events
([YD-0004](/yard/adr/yd-0004-physical-facts-win): the physical fact wins).

## Where the yard's rules come from

- **One place per trailer, one trailer per place.** A trailer on site is at
  exactly one yard spot, one door, or one open move. A spot or door holds at
  most one trailer (`ErrLocationOccupied`). A move's destination is reserved
  when the move is requested (`ErrDestinationReserved`).
- **Moves are pulled.** Hostlers claim the next move with a lease; nothing is
  pushed to them. A lease that expires returns the move to the queue. A
  visiting driver's first move from the gate is the one exception: it is created
  already claimed, with no lease.
- **The gate decides who comes in.** Walk-ins are allowed into a holding spot
  unless the site's policy requires an appointment. A seal mismatch at the gate
  always raises an exception; whether it also rejects the visit is site policy.
- **A visit leaves only when its trailers are released.** Every trailer taken
  out must be off the door and without an open move, and every loaded outbound
  trailer must carry a seal.

## Actors

| Actor | Kind | What they do here |
| --- | --- | --- |
| Gate clerk or kiosk | Person / device | Checks a visit in, rejects it, checks it out (`CheckInVisit`, `RejectAtGate`, `CheckOutVisit`). A camera, ANPR or kiosk is an inbound adapter issuing `CheckInVisit`, not a context. |
| Hostler | Person (floor client) | Claims the next move and completes it (`ClaimNextMove`, `CompleteMove`). Also called jockey, spotter or shunter. |
| Dock operator | Person (floor client) | Starts and completes door work (`StartDoorWork`, `CompleteDoorWork`). Outbound door work is completed here; `outbound-shipping` (released v0.1.0, outside this section) only reads the yard's facts. |
| Yard supervisor | Person (console) | Requests and cancels moves, places and releases holds, records seals, declares the yard policy, runs yard checks. |
| Dock planner | Person (console) | Not an actor here: declares door hours and closures in `dock-scheduling`. This context only reads the closures. |
| Scheduler (cron) | Kubernetes CronJob | Calls `POST /dwell-sweeps` and `POST /move-lease-sweeps`. |
| `dock-scheduling` | Sibling context (upstream and downstream) | Publishes appointments and door closures; consumes visit check-in and trailer docking and undocking. |
| `facility-layout` | Fleet context (upstream) | Publishes the Yard and Dock slots and the zone-to-site mapping. |
| `inbound-receiving` | Fleet context (upstream and downstream) | Publishes ASNs and receipts; consumes `VisitCheckedIn` (its ADR 0021, the dock-to-stock KPI). It does not consume `TrailerDocked` as built; the optional consumer was not built. |
| `exception-management` | Fleet context (downstream) | Opens problem cases from rejected visits, seal exceptions, dwell breaches and yard-check discrepancies (merged on develop). |
| `outbound-shipping` | Fleet context (downstream) | Confirms a shipment when the trailer leaves: reads `TrailerDocked`, `DoorWorkCompleted` and `TrailerDeparted` (`outbound-shipping` is released as v0.1.0 and registered and image-pinned in warehouse-infra develop, PR 205, with the consumer group `outbound-shipping-yard` set, but not applied: no pod, so the edge is not live). |

## Decisions this context makes

From `contexts[yard-management].business_decisions`:

1. A trailer on site is at exactly one place: one yard spot, one door, or one
   open move.
2. A spot or a door holds at most one trailer.
3. A trailer has at most one open move, and a move's destination is reserved
   when the move is requested.
4. Moves are pulled by hostlers (claim-next with a lease), never pushed, as in
   `fulfillment-execution`.
5. A visit checks out only when every trailer it takes is released (not docked,
   no open move) and every loaded trailer of a live-load or pickup visit carries a seal.
6. Walk-ins are allowed into a holding spot unless the site's policy requires an
   appointment.
7. A seal mismatch at the gate raises `SealExceptionRaised`; whether it also
   rejects the visit is site policy (`FLAG` or `REJECT`).

It does **not** decide when a door is booked, whether two appointments overlap,
or whether a window is inside a door's opening hours (`dock-scheduling`), nor
how a trailer is received once it is at a door (`inbound-receiving`).

## How it relates to the industry picture

The capabilities (gate and check-in, yard visibility, move dispatch, door
work, seals and holds, dwell and detention KPIs) follow public analyst and
vendor descriptions of yard management systems. The facts, with citations, are
on [Benchmarks](/yard/research/benchmarks). This page restates none of them.
The names here are this model's own and make no claim about any vendor's
internal design.

## Deliberately out of scope

Each item below is in the model's `future_contexts` or `not_contexts`, or is a
boundary stated in `meta`.

- **Door calendar, bookings, opening hours, no-shows, ETA risk.** These belong
  to `dock-scheduling`.
- **Trailer load planning, loading, bill of lading and ship-confirm.** The context
  `outbound-shipping` (Supporting), released as v0.1.0 in its own repository and outside this section.
- **Real-time ETA feeds.** A future context, `transport-visibility` (Generic);
  an ETA enters `dock-scheduling` first.
- **Detention and yard service charges.** A future context, `yard-billing`
  (Generic). Here the detention free time is only a site setting.
- **Gate camera, ANPR and kiosk.** An inbound adapter, not a context.
- **Reefer temperature telemetry.** Phase 3: a measurement value object on
  `Trailer`, fed by an IoT adapter.
- **A network view across sites.** A cross-site read model of `YardBoardView`
  (ops agent, console), not a context.
- **Autonomous yard trucks.** A device-control seam, reserved and unbuilt.
- **Anything of the retail network.** No `retailnetwork.*` topic is consumed and
  no retail-network service is called; the only channel to the network stays
  `network-fulfillment` and the Vendor API.
- **Authentication and personal data.** The fleet has no auth on REST or MCP,
  and no driver PII is stored: a driver is an opaque `driver_ref`.
