---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the warehouse fleet needs one owner of door time: a calendar that books inbound and outbound carriers on dock doors without double booking, and reacts to arrivals, late ETAs and no-shows."
---

# Business Context

:::info[Proposed design]
Derived from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml). This context's service is not built yet; identifiers (`Err...` names, REST paths, CloudEvents types) are the names the service will use.
:::

## The problem in plain language

A site has a limited number of dock doors, and every carrier that comes to
load or unload needs one. Without a calendar, carriers queue at the gate,
doors sit idle in between and dock labour stands by. The model names the
value this context protects: it is a **cost reducer** (carrier wait,
detention, idle dock labour) and a **revenue protector** (on-time inbound).
The industry basis is on the [benchmarks](/yard/research/benchmarks) page;
this page restates none of it.

`dock-scheduling` supplies the calendar. It owns **booked time on a door**:
who is expected at which door, in which window, in which direction (`INBOUND`
or `OUTBOUND`), from the booking until the door is released. It checks every
booking against four things: the door exists and is an active dock slot, the
door's `dockFlow` allows the direction, the window lies inside the door's
operating hours and outside its closures, and no other active appointment
holds the door in that window.

## One calendar for both directions

Inbound and outbound appointments share **one calendar per door**. A door
whose `dockFlow` is `Both` takes either direction, which is why the
no-double-booking rule cannot be split across two owners. Inbound
appointments name the ASNs they cover; outbound appointments name a CPT or
shipment references. Today the appointment lives in `inbound-receiving` and
covers inbound only; the model moves it here (YD-0002) through the strangler
stages A to E, so that a `Both` door never has two owners of its time.

## The yard decides what physically happened

The scope rule in the model: this context owns the future of a door,
`yard-management` owns the present of the yard. A carrier's arrival, a
trailer docking and a door release are physical facts recorded in
`yard-management`. This context applies them from events:

- `VisitCheckedIn` naming an appointment: the appointment is `CHECKED_IN`
  and gets an `ArrivalStatus` (`EARLY`, `ON_TIME`, `LATE`).
- `TrailerDocked` at a door other than the booked one: the door of the
  appointment changes to the real one. The physical fact wins (YD-0004), even
  if that creates an overlap, in which case the later appointment is flagged
  `DockAppointmentAtRisk`.
- `TrailerUndocked` naming an appointment: the appointment is `COMPLETED`.

Yard events are keyed by visit or trailer, not by appointment, so they can
arrive in any order. Policy `OutOfOrderYardFacts` defines what happens then:
a door release applied to a `BOOKED` appointment completes it and records the
arrival as implicit.

## Plan against reality: ETA risk and no-show

Two things go wrong between a booking and a door.

- **A late ETA.** A carrier (or, later, a transport-visibility feed) reports an
  ETA with `ReportEta`. If the ETA is later than the window start plus the
  site's arrival tolerance, `DockAppointmentAtRisk` (cause `LATE_ETA`) is
  raised, once per ETA report. It is advisory: **nothing reschedules
  automatically**.
- **No arrival.** A `BOOKED` appointment with no arrival by `window_end` plus
  the site's no-show grace becomes `NO_SHOW`. A cron-called sweep
  (`POST /no-show-sweeps`) does it, and `DockAppointmentNoShow` cancels the
  open `TO_DOOR` move for that appointment in `yard-management` (its policy
  `NoShowFreesHolding`), informs `warehouse-planning` and opens a case in
  `exception-management`.

## Actors

| Actor | Kind | What they do here |
| --- | --- | --- |
| Carrier scheduler (carrier portal) | Person or carrier system | Books, reschedules and cancels appointments and reports ETAs over REST |
| Dock planner | Person (console) | Declares door operating hours and booking settings, schedules and lifts closures |
| Scheduler (cron) | Kubernetes CronJob | Calls `POST /no-show-sweeps` |
| Any context | Client | Reads appointments, door availability and the dock calendar over REST |
| `yard-management` | Sibling context (upstream and downstream) | Sends the physical facts (`VisitCheckedIn`, `TrailerDocked`, `TrailerUndocked`); consumes appointments and door closures |
| `facility-layout` | Sibling context (upstream) | Publishes dock slots (with `dockFlow`) and zones, which map a door to its site |
| `inbound-receiving` | Sibling context (upstream and downstream) | Publishes ASNs; consumes appointment events; hands the appointment over (strangler) |
| `process-path-management` | Sibling context (upstream) | Publishes the CPT schedule used by outbound appointments |
| `warehouse-planning` | Sibling context (downstream) | Reads appointments as inbound labour demand |
| `exception-management` | Sibling context (downstream) | Opens a problem case on `DockAppointmentNoShow` |

## Decisions this context makes

From `contexts[dock-scheduling].business_decisions`:

1. **One owner of door time.** Inbound and outbound appointments share one
   calendar per door; a door whose `dockFlow` is `Both` takes either
   direction.
2. **No overlap.** No two active (`BOOKED` or `CHECKED_IN`) appointments
   overlap on the same door. Windows are half-open, so `[10:00, 12:00)` and
   `[12:00, 14:00)` are compatible (`ErrDoorDoubleBooked`).
3. **Direction must fit the door.** An appointment's direction must be
   allowed by the door's `dockFlow` (`ErrDoorFlowMismatch`).
4. **Hours and closures.** A window lies inside the door's operating hours
   and outside every closure of that door (`ErrDoorUnavailable`).
5. **Physical facts are applied, not recorded.** Arrival and door release are
   owned by `yard-management`; this context never records them from its own
   API.
6. **No-show.** A `BOOKED` appointment with no arrival by `window_end` plus
   the site's no-show grace becomes `NO_SHOW` (sweep).
7. **Late ETA is advisory.** An ETA later than `window_start` plus the
   arrival tolerance raises `DockAppointmentAtRisk`; nothing reschedules
   automatically.

It does **not** decide who may enter the gate, where a trailer parks, which
hostler moves it, or when door work starts and ends. Those are
`yard-management`'s.

## How it relates to the real yard

The yard is the enclosed area outside a site's four walls: the gate, the
parking spots and the dock doors. The model is shaped after public
yard-management research, summarised on [benchmarks](/yard/research/benchmarks),
and makes no claim about any vendor's internal design. The names here
(appointment, door window, closure) are this model's own.

## Deliberately out of scope

- **The yard's state.** Gate visits, trailer location, load, seal and hold,
  hostler moves, door work and yard checks belong to `yard-management`.
- **ASNs and receipts.** `inbound-receiving` owns them; this context keeps an
  event-fed copy of the ASNs (`AsnView`) to check that an inbound booking
  covers known, non-cancelled ASNs.
- **Outbound shipment planning.** The future context `outbound-shipping`
  (trailer load planning, loading, bill of lading, ship-confirm) does not
  exist yet. An outbound appointment only carries a `cpt_id` or shipment
  references.
- **ETA feeds.** The future context `transport-visibility` (an
  anti-corruption layer to a real-time transportation visibility platform,
  stub mode first) would feed `ReportEta`. Until then ETAs enter through the
  REST route.
- **Detention invoicing.** The future context `yard-billing` (Generic) is out
  of scope.
- **The retail network.** No yard context consumes a `retailnetwork.*` topic
  or calls a retail-network service; the only channel stays
  `network-fulfillment` and the Vendor API. Outbound pickups are known from
  the fleet's own CPT schedule (YD-0005).
- **Authentication and driver data.** The fleet has no auth on REST or MCP;
  no driver PII is stored here (a driver is an opaque `driver_ref` in
  `yard-management`).
- **Automatic rescheduling.** An at-risk appointment is advisory only.
