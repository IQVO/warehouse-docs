---
id: business-capability-map
title: Business Capability Map
sidebar_label: Business Capability Map
description: "Each feature the Gartner Market Guide for Yard Management lists, mapped to the yard context that owns it and its delivery phase."
---

# Business Capability Map

Features come from the Gartner Market Guide for Yard Management (October 2025), as
quoted on [Benchmarks](/yard/research/benchmarks). The owner and phase columns are
this design's decisions, not Gartner's.

| Feature | Gartner tier | Owner | Phase | Realised by |
| --- | --- | --- | --- | --- |
| Yard visibility and tracking | Mandatory | yard-management | v1 | YardBoardView, Trailer location |
| Yard asset/equipment management | Mandatory | yard-management | v1 | Trailer (kind, unit number, load, seal, hold) |
| Yard management and task assignment | Mandatory | yard-management | v1 | YardMove, claim-next with lease |
| Yard driver task assignment | Mandatory | yard-management | v1 | Hostler claims moves from the floor client |
| Dock and yard parking assignment constraints and capture | Mandatory | yard-management | v1 | Occupancy invariant, DirectOnCheckIn, door flow checks |
| Activity reporting | Mandatory | yard-management | v1 | Analytics reports: dwell, door utilisation, hostler productivity; KPI standard v1 (turn time, detention exposure, exception rates; ADR 0011) released, served once the reports service is switched on |
| Yard audit | Mandatory | yard-management | v1 | YardCheck |
| Check-in, validation and seal verification | Mandatory | yard-management | v1 | YardVisit, SealCheckAtGate |
| Dock appointment scheduling | Common | dock-scheduling | v1 | DockAppointment, DockCalendar |
| Appointment scheduling portal | Common | dock-scheduling | v1 (API) | Carrier-facing REST (OHS); a portal UI is a client |
| Dynamic dock appointment scheduling based on ETA adjustments | Common | dock-scheduling | v1 (advisory) | ReportEta, DockAppointmentAtRisk; no automatic reschedule |
| Gate check-in / gate management | Common | yard-management | v1 | CheckInVisit, RejectAtGate, CheckOutVisit |
| ANPR / license plate recognition | Common | yard-management | adapter | Inbound adapter issuing CheckInVisit |
| Driver kiosk, self-service check-in | Common | yard-management | adapter | Inbound adapter issuing CheckInVisit |
| Visiting driver queue management | Common | yard-management | phase 2 | Holding spot is the v1 queue |
| Real-time gate and yard status monitoring | Common | yard-management | v1 | Yard Board MFE |
| Network ("yard of yards") view and cross-site movement | Common | yard-management | read model | Cross-site read of YardBoardView (console, ops agent) |
| Integration with WMS, TMS, visibility | Common | both | v1 (WMS) | Event-fed local copies; TMS and visibility via future ACLs |
| Dwell time and carrier performance reporting | Common | both | v1 | Dwell with p50 and p90 and turn time per purpose in yard-management, schedule adherence in dock-scheduling |
| Yard capacity planning | Common | - | phase 2 | Not modelled |
| Load/unload enablement | Common | yard-management | v1 | Door work (WAITING, IN_PROGRESS, DONE), AutoCompleteUnload |
| Sensors: RFID, AI vision, temperature | Common | yard-management | phase 3 | Measurement value object fed by an adapter |
| Automated task assignment and orchestration | Common | yard-management | v1 (rule-based) | CallToDoor, ClearDoorAfterWork; optimisation is phase 2 |
| Yard simulation / digital twin | Common | - | not planned | - |

## Not in the yard contexts

| Capability | Where it lives |
| --- | --- |
| Receiving, discrepancy capture, putaway handover | `inbound-receiving` and `inventory-storage` |
| Truck loading, manifesting, bill of lading | `outbound-shipping` (released v0.1.0, registered in warehouse-infra, not applied): ship-confirm follows the physical `TrailerDeparted` of `yard-management`, proven by the `@yard-journey` end-to-end scenario; the dock operator still closes outbound door work in `yard-management` |
| Detention billing | Out of scope; detention exposure (share over a 120-minute threshold) is a KPI only |
