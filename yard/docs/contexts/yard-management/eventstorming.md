---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Yard Management (gate and visits, moves, door work and unload, trailer exceptions, yard checks), with hotspots taken from the model's genuine gaps."
---

# EventStorming

:::info[Built on develop, not deployed]
Built on develop (merged 2026-11-08) in [IQVO/yard-management](https://github.com/IQVO/yard-management), not deployed: registered nowhere in warehouse-infra. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

Process-level EventStorming in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Hotspots are genuine open questions
or risks in the model, tagged `G<n>` on the boards; the source of each is in the
[hotspot table](#hotspots). The yard-wide strategic pages are on
[Strategic Design](/yard/strategic-design/).

## Legend

| Colour | Sticky | Hex |
| --- | --- | --- |
| Blue | Command | `#a5d8ff` |
| Yellow | Aggregate | `#ffec99` |
| Orange | Domain Event | `#ffc078` |
| Lilac | Policy | `#d0bfff` |
| Green | Read Model | `#b2f2bb` |
| Pink | External System (a sibling context or an actor) | `#fcc2d7` |
| Red | Hotspot | `#ff8787` |

## 1. Gate and visits

```mermaid
flowchart LR
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    GC["Gate clerk<br/>or kiosk"]:::ext
    RM1["AppointmentView<br/>LocationView<br/>DoorClosureView"]:::rm
    C1["CheckInVisit"]:::cmd
    C2["RejectAtGate"]:::cmd
    C3["CheckOutVisit"]:::cmd
    A1["YardVisit"]:::agg
    P1["DirectOnCheckIn"]:::pol
    P2["SealCheckAtGate"]:::pol
    E1["VisitCheckedIn"]:::evt
    E2["VisitRejected"]:::evt
    E3["SealException-<br/>Raised"]:::evt
    E4["VisitCheckedOut"]:::evt
    H1["G7 error or<br/>RejectAtGate?"]:::hot
    H2["G5 arrival tolerance<br/>unknown here"]:::hot
    H3["G23 where is the<br/>seal recorded?"]:::hot
    H4["G28 live trailer leaves<br/>DOCKED: released?"]:::hot
    GC --> C1 --> A1
    GC --> C2 --> A1
    GC --> C3 --> A1
    RM1 --> P1
    C1 --> P1
    C1 --> P2
    A1 --> E1
    A1 --> E2
    A1 --> E4
    P2 --> E3
    C2 --- H1
    P1 --- H2
    P2 --- H3
    C3 --- H4
```

Derived from: `model.yaml → contexts[yard-management].policies[DirectOnCheckIn,
SealCheckAtGate]`, `.aggregates[YardVisit]`, `.read_models`, `.inbound`.

Omitted: the refusals `ErrInvalidCarrier`, `ErrVisitAlreadyOpen`,
`ErrAppointmentRequired`, `ErrTrailerNotReleased`, `ErrSealRequired`; the moves that
`DirectOnCheckIn` creates (board 2); consumers of the events (see
[Domain Events](/yard/contexts/yard-management/domain-events)).

## 2. Moves

```mermaid
flowchart LR
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    SU["Yard supervisor"]:::ext
    HO["Hostler"]:::ext
    C1["RequestMove"]:::cmd
    C2["ClaimNextMove"]:::cmd
    C3["CompleteMove"]:::cmd
    P1["LeaseExpirySweep<br/>run by the cron"]:::pol
    C5["ExpireLease"]:::cmd
    A1["YardMove"]:::agg
    A2["Trailer<br/>StartMoving, ArriveAt"]:::agg
    E1["YardMoveRequested<br/>YardMoveClaimed"]:::evt
    E2["YardMoveCompleted"]:::evt
    E3["TrailerParked<br/>TrailerDocked"]:::evt
    H1["G1 trailer left<br/>IN_MOVE"]:::hot
    H2["G14 no event on<br/>lease expiry"]:::hot
    H3["G3 who completes a<br/>visiting-driver move?"]:::hot
    H4["G19 claim order<br/>and priority band"]:::hot
    SU --> C1 --> A1
    HO --> C2 --> A1
    HO --> C3 --> A1
    P1 --> C5 --> A1
    C2 --> A2
    C3 --> A2
    A1 --> E1
    A1 --> E2
    A2 --> E3
    C5 --- H1
    C5 --- H2
    C3 --- H3
    C2 --- H4
```

Derived from: `model.yaml → contexts[yard-management].aggregates[YardMove, Trailer]`
(`transitions`, `notes`), `.policies[LeaseExpirySweep, VisitingDriverMove]`, `.inbound`.

Omitted: the policies that call `RequestMove` (`DirectOnCheckIn`, `CallToDoor`,
`ClearDoorAfterWork`, board 3); `CancelMove` (supervisor, and `NoShowFreesHolding`, with `YardMoveCancelled`); the
refusals `ErrTrailerHasOpenMove`, `ErrDestinationReserved`, `ErrHostlerBusy`,
`ErrNotLeaseHolder`, `ErrUnexplainedDestination`, `ErrLocationOccupied`. Which of the
two trailer events `ArriveAt` raises depends on the destination being a spot or a door.

## 3. Door work and unload

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    DO["Dock operator"]:::ext
    IR["inbound-receiving"]:::ext
    C1["StartDoorWork"]:::cmd
    E0["ReceiptOpened<br/>ReceiptClosed"]:::evt
    RM["ReceiptAtDoorView"]:::rm
    A1["Trailer"]:::agg
    P1["AutoCompleteUnload"]:::pol
    C2["CompleteDoorWork"]:::cmd
    E1["DoorWorkStarted"]:::evt
    E2["DoorWorkCompleted"]:::evt
    P2["ClearDoorAfterWork"]:::pol
    C3["RequestMove<br/>FROM_DOOR"]:::cmd
    E3["TrailerUndocked"]:::evt
    P3["CallToDoor"]:::pol
    C4["RequestMove<br/>TO_DOOR"]:::cmd
    H1["G10 several ASNs,<br/>one trailer"]:::hot
    H2["G8 which command<br/>raises Undocked?"]:::hot
    H3["G9 no appointment<br/>on the trailer"]:::hot
    DO --> C1 --> A1
    DO --> C2 --> A1
    IR --> E0 --> RM --> P1 --> C2
    A1 --> E1
    A1 --> E2 --> P2 --> C3
    A1 --> E3 --> P3 --> C4
    P1 --- H1
    E3 --- H2
    P3 --- H3
```

Derived from: `model.yaml → contexts[yard-management].policies[AutoCompleteUnload,
ClearDoorAfterWork, CallToDoor]`, `.read_models[ReceiptAtDoorView]`,
`.aggregates[Trailer]`.

Omitted: `TrailerDocked` (board 2); `ErrDoorWorkOpen` on departure;
`dock-scheduling`'s reaction to `TrailerUndocked` (`CompleteOnDoorRelease`, see
[Domain Message Flow](/yard/contexts/yard-management/domain-message-flow));
a `LIVE` trailer, which stays at the door until its visit checks out.

## 4. Seals, holds, dwell and trailer exceptions

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    SU["Yard supervisor"]:::ext
    CR["Scheduler cron"]:::ext
    C1["RecordSeal<br/>BreakSeal"]:::cmd
    C2["PlaceHold<br/>ReleaseHold"]:::cmd
    P1["DwellSweep"]:::pol
    A1["Trailer"]:::agg
    E1["TrailerHeld<br/>TrailerHoldReleased"]:::evt
    E2["TrailerDwell-<br/>Exceeded"]:::evt
    EM["exception-management"]:::ext
    H1["G23 BreakSeal has no<br/>trigger, no route"]:::hot
    H2["G21 once per crossing:<br/>where is it kept?"]:::hot
    SU --> C1 --> A1
    SU --> C2 --> A1
    CR --> P1 --> A1
    A1 --> E1
    A1 --> E2 --> EM
    C1 --- H1
    P1 --- H2
```

Derived from: `model.yaml → contexts[yard-management].aggregates[Trailer]`,
`.policies[DwellSweep]`, `.publishes[TrailerHeld, TrailerHoldReleased,
TrailerDwellExceeded]`.

Omitted: `SealExceptionRaised` (board 1); `ErrTrailerOnHold` and `ErrDoorFlowMismatch`
(a hold or a flow mismatch refuses docking; the flow-direction question is G12 in the
table below).

## 5. Yard checks and policy

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    SU["Yard supervisor"]:::ext
    C1["OpenYardCheck<br/>RecordObservation"]:::cmd
    C2["CloseYardCheck"]:::cmd
    C3["DeclareYardPolicy"]:::cmd
    A1["YardCheck"]:::agg
    A2["YardPolicy"]:::agg
    E1["YardCheckClosed"]:::evt
    EM["exception-management"]:::ext
    H1["G18 nothing applies<br/>a discrepancy"]:::hot
    H2["G24 policy defaults<br/>not in the model"]:::hot
    SU --> C1 --> A1
    SU --> C2 --> A1
    SU --> C3 --> A2
    A1 --> E1 --> EM
    E1 --- H1
    C3 --- H2
```

Derived from: `model.yaml → contexts[yard-management].aggregates[YardCheck, YardPolicy]`,
`.publishes[YardCheckClosed]`.

Omitted: `ErrYardCheckOpen`, `ErrLocationAlreadyObserved`, `ErrUnknownLocation`,
`ErrValidation`; `YardPolicy` raises no event.

## Hotspots

Each is a gap in `model.yaml` reported to the orchestrator, not patched here. Severity:
S1 breaks an invariant or the state machine as written, S2 leaves a flow
under-specified, S3 an edge case or contract detail, S4 hygiene.

| # | Sev | Hotspot | Where it comes from in the model | Proposed resolution |
| --- | --- | --- | --- | --- |
| G1 | S1 | `StartMoving` runs at claim, but a `CLAIMED` move can return to `REQUESTED` (lease expiry) or be `CANCELLED`, and `Trailer` has no transition out of `IN_MOVE` except `ArriveAt`. The trailer is then in no place. | `aggregates[Trailer].transitions`; `aggregates[YardMove].transitions`; `Trailer.notes` | Add `IN_MOVE → PARKED` and `IN_MOVE → DOCKED` (return to origin) invoked by `ExpireLease` and `CancelMove` in the same unit of work. |
| G2 | S1 | The first move from the gate: `Trailer` has no initial state; `Location` is only `SPOT` or `DOOR`; `YardMove` and the UL say "or the gate" while `VisitingDriverMove` says "no move to the gate"; a `CLAIMED` move created without a transition. | `aggregates[Trailer].states`; `Location`; `aggregates[YardMove].description`; `ul[Yard Move]`; `policies[VisitingDriverMove]` | Define `RecordArrival` → `IN_MOVE`, `from` = none for the first move, and drop "or the gate" from description and UL. |
| G3 | S2 | Who completes a `VISITING_DRIVER` move: the policy says dock operator or gate clerk, the inbound rows give `CompleteMove` to the hostler only; `ErrNotLeaseHolder` and `ErrHostlerBusy` have no meaning without a lease. | `policies[VisitingDriverMove]`; `inbound`; `YardMove.invariants`; `YardMoveCompleted.hostler_ref` | Add inbound rows for gate clerk and dock operator; state that lease rules apply to `HOSTLER` moves; make `hostler_ref` nullable. |
| G4 | S2 | `Reason` has no value for a move to a plain parking spot (`DirectOnCheckIn` "first free spot"). | `YardMove.value_objects[Reason]`; `policies[DirectOnCheckIn]` | Add `TO_SPOT` or document `RELOCATE`. |
| G5 | S2 | `DirectOnCheckIn` needs the arrival tolerance, a `dock-scheduling` setting that no consumed event carries. | `policies[DirectOnCheckIn]`; `dock-scheduling` `DockCalendar` settings | Add `arrival_tolerance_minutes` to `DockAppointmentBooked`, or to `YardPolicy`. |
| G6 | S2 | `AppointmentView` is fed by four events and cannot know `CHECKED_IN` or `COMPLETED`; `ErrAppointmentRequired` says `BOOKED`, `CallToDoor` says `BOOKED` or `CHECKED_IN`. | `read_models[AppointmentView]`; `YardVisit.invariants`; `policies[CallToDoor]` | Consume `DockAppointmentCheckedIn` and `DockAppointmentCompleted`, or mark the copy from own `VisitCheckedIn` and `TrailerUndocked`. |
| G7 | S2 | Rejection mechanics: refused `CheckInVisit` (an `Err`) versus `RejectAtGate`; `REJECTED` has no transition; `UNKNOWN_APPOINTMENT` has no `Err`; `SealExceptionRaised` names a trailer a rejected visit may not have. | `YardVisit.transitions`, `.commands`, `.invariants`; `reasons[RejectionReason]`; `policies[SealCheckAtGate]` | A refused `CheckInVisit` creates nothing; `RejectAtGate` records `REJECTED`; `REJECT` policy rejects in the same call; add `ErrUnknownAppointment`; make `trailer_id` nullable. |
| G8 | S2 | No stated command raises `TrailerParked`, `TrailerDocked`, `TrailerUndocked`; `Depart`, `BreakSeal`, `RecordLoadState` have no route or policy; `DwellSweep` is on no aggregate. `dock-scheduling` completes only on `TrailerUndocked`. | `Trailer.events`, `.commands`; `inbound`; `policies[DwellSweep]` | `ArriveAt` raises Parked or Docked; `StartMoving` and `Depart` from `DOCKED` raise Undocked; `CheckOutVisit` calls `Depart`; `DwellSweep` is a `Trailer` command. |
| G9 | S2 | No appointment reference on `Trailer` or `YardMove`, yet events carry `appointment_id` and `CallToDoor`, `NoShowFreesHolding` match by appointment. | `Trailer.value_objects`; `YardMove.value_objects`; `YardMoveRequested.data`; `policies` | Add `AppointmentRef` to `Trailer` (set at arrival) and to `YardMove`. |
| G10 | S2 | `AutoCompleteUnload`: `ReceiptClosed` lacks `appointment_id` and `door_code`; one receipt per `asn_number` but a trailer holds several; door-work transitions are not defined (is `WAITING → DONE` allowed?). | `policies[AutoCompleteUnload]`; `read_models[ReceiptAtDoorView]`; `Trailer.value_objects[DoorWork]` | Join via `receipt_id`; complete when every ASN on the trailer has a closed receipt; define the door-work transitions. |
| G11 | S2 | Occupancy checks run at `ArriveAt` (completion), after the hostler is physically there; at request only `ErrDestinationReserved` is named; when the origin is released is not stated; `ErrDestinationReserved` and `ErrLocationOccupied` overlap. | `Trailer.invariants`; `YardMove.invariants`; `business_decisions` | Validate known slot, closure, flow and hold at `RequestMove` too; refuse `CompleteMove` at an occupied location and keep it `CLAIMED`; release the origin at `StartMoving`. |
| G12 | S3 | `ErrDoorFlowMismatch` speaks of a "LOADED inbound" and "an outbound one"; an `EMPTY` trailer for live loading has neither. | `Trailer.invariants`; `Contents`; `LoadState` | Inbound if `asn_numbers` is non-empty; outbound if `outbound_ref` is set or the visit purpose is `LIVE_LOAD` or `PICKUP`. |
| G13 | S3 | `ErrSealRequired` refers to an "OUTBOUND purpose", but `Purpose` has no direction; the `CheckOutVisit` body is not specified. | `YardVisit.invariants`; `Purpose`; `rest` | Define `LIVE_LOAD` and `PICKUP` as outbound; specify `trailers_out`. |
| G14 | S3 | `ExpireLease` changes a move and its `version` but raises no event, against "every accepted change". | `YardMove.events`; `conventions.cloudevents.version_field` | Add an analytics event `YardMoveLeaseExpired`, or exempt it. |
| G15 | S3 | `VisitRejected`, `SealExceptionRaised`, `TrailerDwellExceeded`, `YardCheckClosed` carry no `version`; the element shapes of `trailers` and `discrepancies` are not given; `YardMoveCompleted` has no destination or reason. | `publishes`; `conventions.cloudevents.version_field` | Document the exemption; spell out the shapes. |
| G16 | S3 | HTTP status and problem slug are given only for four generic errors; every domain `Err...` status on these pages is proposed. | `conventions.errors` | Add a status and slug column to the model. |
| G17 | S3 | `VisitRejected` has one consumer, `exception-management`; `dock-scheduling` never learns a booked visit was turned away (`TURNED_AWAY` unused). | `publishes[VisitRejected].consumers`; `dock-scheduling` `CancellationReason` | Add `dock-scheduling` as consumer, cancelling with `TURNED_AWAY`. |
| G18 | S3 | `YardCheck` "reconciles with the model" but no command applies a discrepancy; unobserved locations and in-flight moves are not addressed; no event on open. | `YardCheck.description`, `.events` | State that closing reports only; define `MISSING` for unobserved locations. |
| G19 | S3 | Claim order (band direction, `due_by`, tie-break), the mapping from `window_start` to a band, and the claim body are not given. | `YardMove.value_objects[Priority]`; `policies[CallToDoor]` | Define: lowest band first, then `due_by`, then request time. |
| G20 | S3 | A closure or a decommissioned slot while a trailer is already there is not handled (`ErrDoorClosed` guards arrival only). | `read_models[DoorClosureView, LocationView]` | Raise an exception and request a `RELOCATE` move. |
| G21 | S3 | `DwellSweep` "once per trailer and threshold crossing" needs a stored marker; `free_time_minutes` is used by no rule or event. | `policies[DwellSweep]`; `YardPolicy` | Add a raised-marker; say that detention is a KPI only. |
| G22 | S3 | No free spot, or a full holding area, at check-in has no outcome. | `policies[DirectOnCheckIn]` | Add `ErrNoFreeSpot` or a gate queue. |
| G23 | S3 | Seal handling: where `CheckInVisit` records the seal, when it is compared, what `BreakSeal` triggers (`SEAL_BROKEN` hold?), whether a hold may be placed on a `DOCKED` trailer. | `policies[SealCheckAtGate]`; `Seal`; `HoldReason`; `Trailer.invariants[ErrTrailerOnHold]` | Record the seal in `trailers_in`; `BreakSeal` places a `SEAL_BROKEN` hold. |
| G24 | S3 | `YardPolicy` has no defaults in the model; `meta.status` calls D1-D8 proposals while the plan decision log marks them final. | `aggregates[YardPolicy]`; `meta.status` | Write the confirmed defaults into the model. |
| G25 | S4 | Chart values (differentiation 0.50, complexity 0.60) sit on the quadrant centre line, yet the context is `Supporting`. | `chart` | Document the thresholds. |
| G26 | S4 | The model records no `type` strings of consumed events; `ASNRegistered.lines` is consumed but unused; the three `GET /reports/*` routes have no `inbound` row; the analytics `dataschema` form is not stated. | `consumes`; `read_models[AsnContentView]`; `inbound`, `rest`; `conventions.cloudevents` | Add the missing rows and strings. |
| G27 | S3 | `NoShowFreesHolding` is named for freeing a holding spot but cancels a `TO_DOOR` move; a `CHECKED_IN` appointment cancelled with the trailer on site, and a reschedule to another door with a move open, are not covered. | `policies[NoShowFreesHolding]` | State the intended effects. |
| G28 | S1 | `ErrTrailerNotReleased` says a trailer taken out is not `DOCKED`, while a live visit departs from the door (`DOCKED → DEPARTED`; `VisitingDriverMove`: "for a live visit, from the door"). The check-out rule and the live flow contradict. | `YardVisit.invariants[ErrTrailerNotReleased]`; `business_decisions`; `Trailer.transitions`; `policies[VisitingDriverMove]` | For a live visit, "released" means door work `DONE` and no open move; only a trailer in a spot or in a move must satisfy "not docked". |
