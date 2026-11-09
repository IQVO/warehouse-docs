---
id: model-gap-register
title: Model Gap Register
sidebar_label: Model Gap Register
description: "Every gap the two context packs found in model.yaml, deduplicated, with severity and the decision taken on 2026-11-05."
---

# Model Gap Register

The two context packs were written strictly from
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml).
Where the model was silent or contradicted itself, the pack marked the choice
"proposed" and reported a gap: 22 for `dock-scheduling` (DS-G01 to DS-G22) and 28 for
`yard-management` (YM-G1 to YM-G28). Severity: S1 a cross-context flow cannot work, S2
a rule cannot be built unambiguously, S3 an under-specified rule, S4 shared conventions.

All three S1 and every S2 are **decided and closed in the model**. S3 and S4 items
take the resolution the pack proposed unless the table says otherwise. The decisions
were taken before the services were built and are also recorded in the build contract
(`contracts-delta`), which the service owners follow; where a decision changes a
published event it is stated in the row.

The two packs were written before these decisions. The as-built refresh (2026-11-09) folded them into the pages: a page that still says "proposed" next to a gap id is a historical note, and the decision in this table is the rule the service follows.

| Gap | Severity | What is unclear | Decision |
| --- | --- | --- | --- |
| YM-G1 | S1 | Trailer stuck in no place after lease expiry or cancel of a CLAIMED move | Decided Y-1: ReturnToOrigin transitions IN_MOVE to PARKED or DOCKED, same unit of work. Closed in the model. |
| YM-G28 | S1 | Check-out rule (not docked) contradicts a live visit leaving from the door | Decided Y-2: released = no open move and PARKED, or DOCKED with door work DONE. Closed in the model. |
| YM-G2 | S1 | First move from the gate undefined; "or the gate" contradicts VisitingDriverMove | Decided Y-1: RecordArrival creates the trailer IN_MOVE with a CLAIMED VISITING_DRIVER move, from none, no lease; no move goes to the gate. Closed in the model. |
| YM-G3 | S2 | Completion of visiting-driver moves has no actor row; lease errors meaningless | Decided Y-3: gate clerk or dock operator complete; lease errors apply to hostler moves only; hostler_ref nullable. Closed in the model. |
| YM-G4 | S2 | No Reason for a move to a plain spot | Decided Y-4: TO_SPOT added. Closed. |
| YM-G5 / DS-G01 | S2 | Arrival tolerance has no source in yard-management | Decided X1: Booked and Rescheduled carry arrival_tolerance_minutes. Closed. |
| YM-G6 | S2 | AppointmentView cannot know CHECKED_IN or COMPLETED | Decided X4: yard marks its copy from its own VisitCheckedIn and TrailerUndocked. |
| YM-G7 | S2 | Rejection mechanics ambiguous | Decided Y-5: refused check-in creates nothing; RejectAtGate records REJECTED; ErrUnknownAppointment added; SealExceptionRaised.trailer_id nullable. Closed. |
| YM-G8 | S2 | No command raises Parked/Docked/Undocked; Depart and BreakSeal uncalled | Decided Y-6. Closed. |
| YM-G9 | S2 | Trailer and YardMove carry no appointment reference | Decided X3: appointment_id added to both. Closed. |
| YM-G10 | S2 | AutoCompleteUnload join and multi-ASN trailers | Decided Y-7: join via receipt_id; complete when every ASN has a closed receipt. |
| YM-G11 | S2 | Occupancy checks run only at ArriveAt | Decided Y-8: validate at RequestMove too; occupied ArriveAt refused, move stays CLAIMED. |
| DS-G02 / YM-G17 | S2 | Rejected visit leaves the appointment BOOKED; TURNED_AWAY unused | Decided X2: dock-scheduling consumes VisitRejected and cancels with TURNED_AWAY. Closed. |
| YM-G12, G13 | S3 | Door-flow mismatch and seal-required phrasing; check-out body | Decided Y-9. |
| YM-G14, G15 | S3 | ExpireLease emits no event; some events lack version; array shapes | Decided Y-10: YardMoveLeaseExpired added (analytics); exemptions documented. |
| YM-G16 / DS-G17 | S3/S4 | Statuses and slugs for domain errors | Decided D-10: 409 conflicts and illegal states, 422 value and reference rules; slug is the kebab-cased Err name. |
| YM-G18, G19 | S3 | Yard check reconcile semantics; claim order and priority bands | Decided Y-11. |
| YM-G20, G22 | S3 | Trailer on a closed place; no free spot | Decided Y-12: closed-place handling is phase 2; ErrNoFreeSpot (409). |
| YM-G21, G23, G24, G27 | S3 | Dwell marker, seals at the gate, policy defaults, NoShowFreesHolding effects | Decided Y-13, Y-14 and contracts-delta Defaults. Dwell marker DwellAlertedAt added to the model. |
| YM-G25, G26 | S4 | Chart on the quadrant line; consumed type strings | Accepted as proposed; type strings are read from producer AsyncAPI. |
| DS-G03 | S3 | Multi-trailer visits | Decided X3: one appointment covers exactly one trailer. |
| DS-G04, G05 | S3 | PickupFromCutoffs rule, ship_method and cpt shape | Decided D-3: phase 2; consume and store CPTScheduleChanged only. |
| DS-G06 | S3 | Reschedule door change | Decided D-4 and X1: a reschedule may change the door; previous_door_code added. |
| DS-G07 | S3 | DockCalendar creation and defaults | Decided D-1: lazy creation; open 24x7 without hours; defaults in contracts-delta. |
| DS-G08 | S3 | Legacy import invariants | Decided D-2. |
| DS-G09 | S3 | ArrivalStatus formula | Decided X6. |
| DS-G10 | S3 | Dock planner cannot cancel or reschedule | Decided D-5. |
| DS-G11 | S3 | At-risk visibility and MCP tools | Decided D-6. |
| DS-G12 | S3 | Decommissioned door with appointments | Decided D-7: blocks new bookings only. |
| DS-G13 | S3 | Hours change vs existing appointments | Decided D-8: refused with ErrHoursConflictWithAppointments. |
| DS-G14 | S3 | inbound-receiving copy lacks Rescheduled/NoShow | Decided X7: not needed. |
| DS-G15 | S3 | Door code uniqueness and zone-before-slot ordering | Decided X5. |
| DS-G16 | S3 | Arrival after NO_SHOW | Decided D-9: book anew. |
| DS-G18, G19, G20, G21, G22 | S4 | Consumed type strings, out-of-order table, enumerations, granularity, report row | Decided D-11, D-12, D-13; the remaining items are accepted as the pack proposes. |
