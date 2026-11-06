---
id: benchmarks
title: Benchmarks
sidebar_label: Benchmarks
description: "The analyst and vendor research the yard design rests on: the Gartner Market Guide for Yard Management, SAP, Oracle, Manhattan, Blue Yonder, Kaleris, FourKites and Opendock, plus the estate facts that shape it."
---

# Benchmarks

This page holds cited facts only. The design derived from them is in the
[model](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml)
and is a proposed reference model, not a claim about any vendor's internal design.
Bracketed numbers map to the Sources list at the end.



## 1. What a YMS is (analyst definition)

Gartner defines a yard management system as software that supports the efficient
flow of work, equipment and materials through the normally enclosed area outside a
warehouse, distribution center or manufacturing facility, known as the yard.[1][3]
It covers the planning, direction, monitoring and control of scheduling, moving,
parking, inspecting and reassigning trucks, trailers and containers in the yard.[1]
YMSs typically oversee three areas: the gate/kiosk, the yard itself, and inbound and
outbound dock door scheduling.[1][3]
YMSs are sold as extended WMS modules, as independent suites, or as part of a TMS,
and the gate, yard and dock components may be sold independently or combined.[1][3]

Gartner places the yard between the warehouse and transportation: the two meet in
the yard, which is often a "black hole" where companies lack visibility to
activities, inventory and equipment.[1]
Its WMS capabilities figure lists dock schedule, truck loading and manifesting as
WMS capabilities, and it notes that basic YMS capabilities are often part of a WMS
offering's extended capabilities, while advanced ones usually come from YMS
specialists.[1]
Gartner expects the next wave of optimization to bring WMS, YMS and TMS closer
together.[1]

## 2. Capability checklist (Gartner 2025 Market Guide)

Mandatory features: yard visibility and tracking; yard asset/equipment management;
yard management and task assignment; yard driver task assignment; dock and yard
parking assignment constraints and capture; activity reporting; yard audit;
check-in, validation and seal verification.[1]

Common features: dock appointment scheduling; an appointment scheduling portal; a
carrier/customer web portal for trailer pools; dynamic dock appointment scheduling
based on ETA adjustments; gate check-in and gate management; ANPR; driver kiosk and
self-service check-in; visiting driver queue management; real-time gate and yard
status; equipment aging reports; a network ("yard of yards") view and cross-site
movement; visiting driver alerts; yard driver mobile apps; WMS/TMS/visibility
integration; RFID, AI vision and temperature sensors; dwell time and carrier
performance reporting; yard capacity planning; load/unload enablement; automated
task assignment and orchestration; yard simulation or digital twin.[1]

The three functional areas as Gartner describes them:[1]

- Gate/kiosk: controls vehicles entering and leaving and alerts the system of an
  arrival to trigger the next action; manned, unmanned or kiosk based.
- Yard: decides where vehicles, trailers and containers park before or after
  loading/unloading, audits equipment and inventory, and plans and directs the yard
  jockeys (hostlers, shunters) who move trailers between doors and parking spots,
  using mobile devices instead of radio.
- Loading docks/bays: schedules and directs vehicles to specific doors depending on
  door availability, sometimes labor, and the putaway proximity; it can work with
  the yard elements to manage dwell time and shipment urgency.

Use cases and benefits Gartner lists: process improvement of check-in/check-out and
flow; visibility of yard assets and an end to "lost" trailers; reduced detention,
demurrage, idle rental and idle dock labor; carrier on-time, wait and unload time
analysis.[1]

## 3. How the major suites decompose it

SAP Yard Logistics separates inbound, outbound and internal transport processing
(yard requests and yard orders grouping transportation units), check-in and
check-out posting, yard inventory with location determination for each unit, yard
monitoring with a graphical cockpit and alerts, yard tasks (manual or rule-created,
desktop or mobile), measurements with thresholds, inspections, check questionnaires
that allow or prohibit an activity, yard billing, and integration with dock
appointment scheduling, EWM (check-in/out, door details, arrival and departure at
the door) and TM (transport plan, check-in/out, seals).[4]
SAP uses yard requests and related yard orders to group transportation units for
inbound processing.[4]

Oracle Yard Management models check-in for inbound and outbound shipments with or
without an appointment, seal checks that raise an exception, a holding area for
early or unscheduled arrivals, check-out, dock appointments as single time slots per
door (inbound, outbound or other), and yard moves executed by jockeys on mobile
devices.[8]
After a trailer checks in it is moved to a parking place or to a dock door for
unloading or loading.[8]
Its users are warehouse and shift managers, shipping and receiving managers, yard
supervisors, jockeys, and gate clerks; it alerts on late, early or on-time arrival,
seal validation and wrong equipment for an appointment.[9]

Manhattan Active Yard Management unifies yard, dock, warehouse and transportation
execution: a graphical view of doors and yard positions with pending arrivals and
trailer contents, door progress for inbound and outbound, trailer prioritisation and
door assignment, and live versus drop load handling.[5]
Its trailer selection prioritises the door that minimises putaway travel, trailers
with the most cross-dock content, and trailers that resolve SKU shortages.[5]
Manhattan describes the yard as the point where warehouse operations pass the baton
to transportation.[6]

Blue Yonder emphasises gate automation with camera vision, real-time yard mapping
from cameras on yard trucks, and a driver/carrier portal.[7]
Kaleris argues that WMS yard add-ons act as passive record keepers and that a
purpose-built YMS coordinates gate, yard and dock movement; it lists automated gate
check-in/out, dock scheduling based on door capability, capacity and labor, reefer
temperature and fuel monitoring, and mobile workflows for gate operators and yard
jockeys.[10]
Kaleris also offers driver kiosks and RTLS-based asset matching.[11]
FourKites models the yard as a "Facility Twin" covering yard, dock and gate:
trailer inventory, dock assignment, spotter tasking and reefer monitoring.[12]
Terminal Industries draws a line between a YMS (tracks trailer inventory) and a
"yard operating system" that also runs gate, check-in, dock coordination and yard
moves.[14]

## 4. KPIs

The core yard KPIs are yard dwell time (gate-in to gate-out), dwell by trailer type
(live, drop, reefer, intermodal), door utilization, yard truck productivity (moves
per truck per hour or shift) and driver wait time.[13]
Opendock splits on-site time into waiting time (arrival to in progress) and
processing time (in progress to completed).[13]
Lower dwell reduces detention and demurrage costs.[13]

## 5. Facts about the estate that shape the design

These come from the service repositories (origin/develop, 2026-11-05), not from the web.
- `inbound-receiving` ADR 0001 lists "Yard and trailer management (gate, yard
  slots, trailer tracking)" as out of scope: "an appointment ends at the door".
  It owns the `DockAppointment` aggregate (inbound only, states Booked, CheckedIn,
  Cancelled, Completed; no two Booked/CheckedIn windows overlap on one door, via the
  `Schedule.CheckNoOverlap` domain service and a per-door advisory lock; MaxWindow
  4 h). Closing a receipt completes the appointment in the same unit of work.
- `facility-layout` ADR 0016 already has `LocationRole` `Dock` (with required
  `DockFlow` `Inbound|Outbound|Both`) and `Yard`, published on
  `LocationSlotRegistered`. Nothing consumes the `Yard` role today.
- `warehouse-planning` ADR 0017 consumes `DockAppointmentBooked/Cancelled` as
  inbound labour demand and records that the events carry no site and no quantities.
- `process-path-management` publishes `CPTScheduleChanged`
  (`site_id`, `timezone`, `cutoffs[]\{cpt_id, local_time, days_of_week, ship_method\}`).
  The network integration page states the fleet's CPT is the network's pickup cutoff.
- No context models an outbound dock appointment, a trailer, a yard spot occupancy,
  a gate visit, a yard move or a seal. `fulfillment-execution` `PackageManifested`
  carries only `package_id` and `order_ref` (no door, no trailer).
- The fleet never consumes `retailnetwork.*` topics; the Vendor API exposes no pickup
  departures to the vendor.

## 6. Gaps in public knowledge

- Gartner names features, not data models: aggregate boundaries are our design.
- No vendor publishes its door-assignment or spot-selection algorithm in detail;
  Manhattan names the criteria only.[5]
- No public source was retrieved for a standard detention free-time value, so the
  model makes it a site setting with no default claim.

## Sources

[1] https://c3solutions.com/wp-content/uploads/2026/02/Market_Guide_for_Yard-management-Gartner-2025-1.pdf — Gartner, Market Guide for Yard Management, 27 Oct 2025 (G00785019), republished by C3 Solutions
[3] https://www.gartner.com/reviews/market/yard-management — Gartner Peer Insights: Yard Management market definition
[4] https://help.sap.com/doc/43bdfe7467064f8290d7e5f9c6648609/2024/en-US/sap_yl-s4h_feature_scope_description_en.pdf — SAP Yard Logistics 2024 for SAP S/4HANA, Feature Scope Description
[5] https://www.manh.com/solutions/supply-chain-management-software/yard-management — Manhattan Active Yard Management product page
[6] https://www.manh.com/our-insights/resources/articles/what-is-yard-management — Manhattan, What is a Yard Management System? (2024)
[7] https://blueyonder.com/solutions/warehouse-management/yard-management — Blue Yonder Yard Management product page
[8] https://docs.oracle.com/cd/E26401_01/doc.122/e53453/T632044T632632.htm — Oracle Yard Management Process Guide: Managing Yard Operations
[9] https://docs.oracle.com/cd/E26401_01/doc.122/e53453/T632044T632047.htm — Oracle Yard Management Process Guide: Overview
[10] https://kaleris.com/why-a-purpose-built-yms-outperforms-wms — Kaleris, Why a purpose-built YMS outperforms WMS yard modules
[11] https://kaleris.com/solutions/yard-management — Kaleris Yard Management product page
[12] https://fourkites.com/yms — FourKites Site Intelligence / Facility Twin
[13] https://blog.opendock.com/yard-management-system-roi — Opendock, How to measure YMS ROI and KPIs (Feb 2026)
[14] https://terminal-industries.com/all-resources/yms-vs-yos-vs-wms-vs-tms-what-s-the-difference- — Terminal Industries, YMS vs YOS vs WMS vs TMS
