---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: "Yard Management scenarios as ddd-crew domain message flows: a live unload, a drop and its later door call, gate rejection and seal mismatch, a hostler move with lease expiry, and a cancelled appointment."
---

# Domain Message Flow

:::info[Built on develop, not deployed]
Built on develop (merged 2026-11-08) in [IQVO/yard-management](https://github.com/IQVO/yard-management), not deployed: registered nowhere in warehouse-infra. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from `model.yaml`,
prefixed `cmd:`, `qry:` or `evt:`. Events are written `entity.EventName`; the full
type is `com.warehouse.wms.<producer>.<entity>.<EventName>` (see
[Domain Events](/yard/contexts/yard-management/domain-events)). Route parameters are
written without braces. Events on the analytics topic only
(`warehouse.yard-management.analytics`) are not drawn as arrows. The yard-wide flows
are on [Strategic Design](/yard/strategic-design/).

## 1. Live unload: from booking to door release

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant DS as dock-<br/>scheduling
    actor GC as Gate clerk<br/>or kiosk
    participant YM as yard-<br/>management
    actor DO as Dock<br/>operator
    participant IR as inbound-<br/>receiving
    DS->>YM: evt: dockappointment.<br/>DockAppointmentBooked<br/>door, window, expected seal
    Note over YM: AppointmentView
    GC->>YM: cmd: CheckInVisit<br/>POST /visits<br/>purpose LIVE_UNLOAD
    Note over YM: DirectOnCheckIn<br/>door free, open, flow ok<br/>VISITING_DRIVER move<br/>TO_DOOR, created CLAIMED
    YM->>DS: evt: yardvisit.<br/>VisitCheckedIn<br/>appointment_id
    Note over DS: ArrivalFromGate<br/>CHECKED_IN
    DO->>YM: cmd: CompleteMove<br/>POST /moves/moveId/<br/>completions
    Note over YM: Trailer ArriveAt door<br/>Occupancy.CheckFree
    YM->>DS: evt: trailer.TrailerDocked
    YM->>IR: evt: trailer.TrailerDocked
    Note over DS: ActualDoorWins<br/>reassign only if the door differs
    DO->>YM: cmd: StartDoorWork<br/>POST /trailers/trailerId/<br/>door-work-starts
    IR->>YM: evt: receipt.ReceiptOpened<br/>appointment_id, door_code
    IR->>YM: evt: receipt.ReceiptClosed
    Note over YM: AutoCompleteUnload<br/>CompleteDoorWork<br/>load_state EMPTY
    GC->>YM: cmd: CheckOutVisit<br/>POST /visits/visitId/<br/>check-outs
    YM->>DS: evt: trailer.TrailerUndocked<br/>appointment_id
    Note over DS: CompleteOnDoorRelease<br/>COMPLETED
```

Derived from: `model.yaml → contexts[yard-management].inbound`, `.policies[DirectOnCheckIn,
VisitingDriverMove, AutoCompleteUnload]`, `.publishes[VisitCheckedIn, TrailerDocked,
TrailerUndocked]`, `.consumes`; `contexts[dock-scheduling].policies[ArrivalFromGate,
ActualDoorWins, CompleteOnDoorRelease]`.

Omitted: analytics events (`VisitCheckedOut`, `DoorWorkStarted`, `DoorWorkCompleted`,
`TrailerDeparted`, `YardMove*`); the `receipt` work itself (`inbound-receiving`'s). The
model fires `TrailerDocked` and `TrailerUndocked` without naming the command that
raises them, and names no command that departs a trailer: this pack reads `ArriveAt`
as raising `TrailerDocked`, and `CheckOutVisit` as calling `Depart` for the trailer,
which raises `TrailerUndocked` from the door (gaps YM-G8, YM-G28: the check-out rule says a taken-out trailer is not docked). Who completes the
visiting driver's move is the policy text (dock operator or gate clerk), not an
inbound row (gap YM-G3). The order of `StartDoorWork` and `ReceiptOpened` is not
stated; `AutoCompleteUnload` may complete door work that was never started (gap YM-G10).

## 2. Drop, then the door call and the return to a spot

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant DS as dock-<br/>scheduling
    actor GC as Gate clerk
    participant YM as yard-<br/>management
    actor HO as Hostler
    actor DO as Dock<br/>operator
    DS->>YM: evt: dockappointment.<br/>DockAppointmentBooked
    GC->>YM: cmd: CheckInVisit<br/>purpose DROP, appointment
    Note over YM: DirectOnCheckIn<br/>the door is not free<br/>move to the first free spot<br/>of the parking zones
    YM->>DS: evt: yardvisit.<br/>VisitCheckedIn
    GC->>YM: cmd: CompleteMove<br/>at the spot
    Note over YM: Trailer PARKED<br/>TrailerParked on analytics
    GC->>YM: cmd: CheckOutVisit<br/>no trailer taken out
    Note over YM: the tractor leaves<br/>the dropped trailer stays
    YM->>DS: evt: trailer.TrailerUndocked<br/>the trailer ahead leaves the door
    Note over YM: CallToDoor<br/>HOSTLER move TO_DOOR<br/>due_by window_start
    HO->>YM: cmd: ClaimNextMove<br/>POST /moves/claims
    HO->>YM: cmd: CompleteMove
    YM->>DS: evt: trailer.TrailerDocked
    DO->>YM: cmd: StartDoorWork
    DO->>YM: cmd: CompleteDoorWork<br/>POST /trailers/trailerId/<br/>door-work-completions
    Note over YM: ClearDoorAfterWork<br/>DROP trailer: HOSTLER move<br/>FROM_DOOR to a free spot
    HO->>YM: cmd: ClaimNextMove
    YM->>DS: evt: trailer.TrailerUndocked<br/>appointment_id
    Note over DS: CompleteOnDoorRelease<br/>COMPLETED
    HO->>YM: cmd: CompleteMove<br/>to the spot
```

Derived from: `model.yaml → contexts[yard-management].policies[DirectOnCheckIn, CallToDoor,
ClearDoorAfterWork, VisitingDriverMove]`, `.aggregates[Trailer, YardMove, YardVisit]`,
`.publishes`; `contexts[dock-scheduling].policies[CompleteOnDoorRelease]`.

Omitted: `YardMoveRequested`, `YardMoveClaimed` and `YardMoveCompleted` (analytics only);
how `CallToDoor` chooses among several `PARKED` trailers (the next appointment of that
door by `window_start`). The point at which the appointment completes is this pack's
reading: `dock-scheduling` completes on `TrailerUndocked`, and the trailer leaves the
door when the `FROM_DOOR` move is claimed (`StartMoving` from `DOCKED`). The model does
not say that (gap YM-G8). The reason of the first move to a plain parking spot has no
value in `Reason` (gap YM-G4). A drop's trailer is linked to its appointment only
through event fields, not a value object of `Trailer` (gap YM-G9).

## 3. Gate rejection: an appointment is required

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor GC as Gate clerk<br/>or kiosk
    participant YM as yard-<br/>management
    participant EM as exception-<br/>management
    participant DS as dock-<br/>scheduling
    GC->>YM: cmd: CheckInVisit<br/>POST /visits<br/>no BOOKED appointment
    Note over YM: YardPolicy<br/>require_appointment is true
    YM-->>GC: reply: problem<br/>ErrAppointmentRequired
    GC->>YM: cmd: RejectAtGate<br/>POST /visit-rejections<br/>reason APPOINTMENT_REQUIRED
    Note over YM: YardVisit REJECTED
    YM->>EM: evt: yardvisit.<br/>VisitRejected
    Note over EM: opens a problem case
    Note over DS: not told<br/>the model names no consumer
```

Derived from: `model.yaml → contexts[yard-management].aggregates[YardVisit]`
(`invariants`, `commands`), `.publishes[VisitRejected]`, `.reasons[RejectionReason]`,
`.business_decisions`; `fleet_changes[exception-management]`.

Omitted: the other reasons (`UNKNOWN_APPOINTMENT`, `TRAILER_ALREADY_ON_SITE`,
`SITE_REQUEST`). The model has both an error on `CheckInVisit` (`ErrAppointmentRequired`)
and a command that records a rejection (`RejectAtGate`); the two-step flow shown is this
pack's reading (gap YM-G7). `dock-scheduling` has the cancellation reason `TURNED_AWAY`
but receives no `VisitRejected`, so a booked appointment turned away at the gate stays
`BOOKED` until the no-show sweep (gap YM-G17).

### 3b. Seal mismatch at the gate

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor GC as Gate clerk<br/>or kiosk
    participant YM as yard-<br/>management
    participant EM as exception-<br/>management
    participant DS as dock-<br/>scheduling
    GC->>YM: cmd: CheckInVisit<br/>seal differs from the<br/>expected_seal_number
    Note over YM: SealCheckAtGate
    YM->>EM: evt: trailer.<br/>SealExceptionRaised<br/>expected, found
    alt seal_mismatch_action FLAG
        YM->>DS: evt: yardvisit.<br/>VisitCheckedIn
        Note over YM: the visit goes on<br/>exception raised only
    else seal_mismatch_action REJECT
        YM->>EM: evt: yardvisit.<br/>VisitRejected<br/>reason SEAL_MISMATCH
    end
```

Derived from: `model.yaml → contexts[yard-management].policies[SealCheckAtGate]`,
`.aggregates[YardPolicy]` (`seal_mismatch_action`), `.reasons[RejectionReason]`,
`.publishes[SealExceptionRaised, VisitRejected]`.

Omitted: the other `Trailer` and `YardVisit` events of a normal check-in. Where the
seal is recorded at the gate (`RecordSeal` is a supervisor route; `CheckInVisit` lists
no seal field) and what trailer the exception names when the visit is then rejected
are not stated (gaps YM-G7, YM-G23).

## 4. A hostler claims a move, the lease expires, another hostler completes it

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SU as Yard<br/>supervisor
    actor H1 as Hostler A
    actor H2 as Hostler B
    participant YM as yard-<br/>management
    participant CR as Scheduler<br/>cron
    SU->>YM: cmd: RequestMove<br/>POST /moves<br/>destination reserved
    H1->>YM: cmd: ClaimNextMove<br/>POST /moves/claims
    Note over YM: REQUESTED to CLAIMED<br/>lease of lease_seconds<br/>Trailer StartMoving
    CR->>YM: cmd: ExpireLease<br/>POST /move-lease-sweeps
    Note over YM: CLAIMED to REQUESTED<br/>no event raised<br/>trailer stays IN_MOVE
    H2->>YM: cmd: ClaimNextMove<br/>POST /moves/claims
    H1->>YM: cmd: CompleteMove<br/>late, lease lost
    YM-->>H1: reply: problem<br/>ErrNotLeaseHolder
    H2->>YM: cmd: CompleteMove<br/>POST /moves/moveId/<br/>completions
    Note over YM: Trailer ArriveAt<br/>Occupancy.CheckFree
    YM-->>H2: ok, move COMPLETED
```

Derived from: `model.yaml → contexts[yard-management].aggregates[YardMove]`
(`transitions`, `invariants`), `.policies[LeaseExpirySweep]`, `.inbound`, `.rest`.

Omitted: the analytics events `YardMoveRequested`, `YardMoveClaimed` and
`YardMoveCompleted`; the result when nobody re-claims the move (a late `CompleteMove`
from `REQUESTED` is `ErrIllegalTransition`); `ErrHostlerBusy` when a hostler already
holds a `CLAIMED` move. The model returns the move to `REQUESTED` on expiry and has no
transition that brings the trailer back from `IN_MOVE` (gap YM-G1); it raises no event
for the expiry (gap YM-G14). There is no lease renewal in the model.

## 5. An appointment is cancelled while a door call is open

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 104, "actorMargin": 12, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant DS as dock-<br/>scheduling
    participant YM as yard-<br/>management
    DS->>YM: evt: dockappointment.<br/>DockAppointmentCancelled<br/>or DockAppointmentNoShow
    Note over YM: AppointmentView updated
    alt an open TO_DOOR move exists for it
        Note over YM: NoShowFreesHolding<br/>CancelMove
        alt the move is REQUESTED
            Note over YM: CANCELLED<br/>nothing else changes
        else the move is CLAIMED
            Note over YM: CANCELLED<br/>trailer left IN_MOVE
        end
    else no open move
        Note over YM: view update only
    end
```

Derived from: `model.yaml → contexts[yard-management].policies[NoShowFreesHolding]`,
`.consumes[dock-scheduling]`, `.aggregates[YardMove].transitions`.

Omitted: how the move is linked to the appointment (neither `YardMove` nor `Trailer`
carries an appointment reference in the model, gap YM-G9); what the policy does for a
`DockAppointmentRescheduled` to another door; what happens to a trailer on site when a
`CHECKED_IN` appointment is cancelled (gap YM-G27). The `CLAIMED` branch ends with the
trailer `IN_MOVE` and no open move: a state the model's "exactly one place" rule does
not allow (gap YM-G1).
