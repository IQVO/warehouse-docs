---
id: subdomain-classification
title: Subdomain Classification
sidebar_label: Subdomain Classification
description: "Core, Supporting or Generic: the two yard bounded contexts, the deferred contexts and the verdict rationale for each."
---

# Subdomain Classification

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::

Subdomains are classified by how much competitive advantage they give, not by size.

## Bounded contexts

| Context | Classification | Differentiation | Complexity | Evolution | Business model |
| --- | --- | --- | --- | --- | --- |
| `dock-scheduling` | Supporting | 0.4 | 0.45 | Product | Cost reducer (carrier wait, detention, idle dock labour) and revenue protector (on-time inbound) |
| `yard-management` | Supporting | 0.5 | 0.6 | Custom-built | Cost reducer (detention, demurrage, lost trailers, idle dock labour) and throughput enabler |

Both are Supporting: every site with trucks needs them and the rules (window length, seal policy, dwell thresholds) differ per operator, but the platform does not win on them. See [Benchmarks](/yard/research/benchmarks).

## Deferred contexts and contexts outside this section

| Context | Classification | Note |
| --- | --- | --- |
| `outbound-shipping` | Supporting | Trailer load planning, loading, bill of lading and ship-confirm (Gartner lists truck loading and manifesting as WMS capabilities). BUILT on develop as IQVO/outbound-shipping, released as v0.1.0 and registered in warehouse-infra (PR 205) but not applied (no pod), and consuming the yard facts; it is outside the yard section. Outbound door work is still completed by the dock operator in yard-management. |
| `transport-visibility` | Generic | ACL to a real-time transportation visibility platform for ETAs; stub mode first (network-fulfillment *_MODE=stub precedent). Feeds dock-scheduling ReportEta. |
| `yard-billing` | Generic | Detention and yard service charges; out of scope. |

## Deliberately not contexts

| Item | Reason |
| --- | --- |
| gate camera / ANPR / kiosk | an inbound adapter that issues CheckInVisit (hexagonal), not a context |
| reefer temperature telemetry | phase 3 measurement value object on Trailer fed by an IoT adapter |
| yard of yards network view | a cross-site read model of YardBoardView (ops agent, console), not a context |
| autonomous yard trucks | a device-control seam like WCS, reserved and unbuilt |

## Business decisions each context enforces

### `dock-scheduling`

- One owner of door time. Inbound and outbound appointments share one calendar per door; a door whose dockFlow is Both takes either direction.
- No two active (BOOKED or CHECKED_IN) appointments overlap on the same door. Windows are half-open, so [10:00, 12:00) and [12:00, 14:00) are compatible.
- An appointment's direction must be allowed by the door's dockFlow.
- A window lies inside the door's operating hours and outside every closure of that door.
- Arrival and door release are physical facts owned by yard-management; this context applies them from events and never records them from its own API.
- A BOOKED appointment with no arrival by window_end plus the site's no-show grace becomes NO_SHOW (sweep).
- An ETA later than window_start plus the arrival tolerance raises an advisory DockAppointmentAtRisk; nothing reschedules automatically.
- An ASN sits on only one active native appointment (decision D-12); one appointment covers exactly one trailer (X3).
- COMPLETED, CANCELLED and NO_SHOW are terminal, so a late carrier books anew (D-9). The dock planner may reschedule and cancel (CARRIER_REQUEST, SITE_REQUEST) like the carrier portal (D-5).
- A booking or reschedule naming the SCAC of a registered SUSPENDED carrier is refused (carrier-suspended); an unregistered SCAC is accepted as before, so the registry is opt-in (ADR 0012). Appointments a carrier already holds are not cancelled by its suspension: a person decides.

### `yard-management`

- A trailer on site is at exactly one place - one yard spot, one door, or one open move.
- A spot or a door holds at most one trailer.
- A trailer has at most one open move, and a move's destination is reserved when the move is requested.
- Moves are pulled by hostlers (claim-next with a lease), never pushed, as in fulfillment-execution.
- A visit checks out only when every trailer it takes is released (not docked, no open move) and every loaded outbound trailer carries a seal.
- Walk-ins are allowed into a holding spot unless the site's policy requires an appointment.
- A seal mismatch at the gate raises SealExceptionRaised; whether it also rejects the visit is site policy (FLAG or REJECT).
- A container, or a unit declared ISO6346, carries a valid ISO 6346 unit number; a seal carries an optional ISO 17712 class (I, S, H) and a site may set a minimum class (ADR 0012).
- \{'Dock safety interlock (ADR 0013)': 'a DOCKED trailer is secured (RESTRAINT or WHEEL_CHOCKS) before door work starts where the site policy requires it, and a secured trailer leaves neither its door nor the gate until the securing is released.'\}
- \{'Hazmat and reefer placement (ADR 0014)': 'a trailer that declares a hazard class or a temperature-control need is placed only on a yard spot whose kind its contents allow.'\}
