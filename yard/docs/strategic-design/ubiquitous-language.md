---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The yard glossary by bounded context, with the code name each term has in the model."
---

# Ubiquitous Language

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::

## `dock-scheduling`

| Term | Definition | Code |
| --- | --- | --- |
| Dock Appointment | A booked window on one door for one carrier visit, inbound or outbound. | `dockappointment.DockAppointment` |
| Door Window | The half-open interval [start, end) an appointment holds on its door. | `dockappointment.Window` |
| Door Calendar | A site's door opening hours, closures and booking settings. | `dockcalendar.DockCalendar` |
| Closure | A period a door cannot be booked (maintenance, damage). | `dockcalendar.Closure` |
| Arrival Status | EARLY, ON_TIME or LATE, from the gate arrival against the window and the tolerance. | `dockappointment.ArrivalStatus` |
| No-Show | A booked appointment whose carrier did not arrive by window end plus grace. | `dockappointment.NoShow` |
| SCAC | Standard Carrier Alpha Code identifying the carrier. | `shared.Carrier` |
| Carrier Registry | The carriers known to the calendar, keyed by SCAC, each ACTIVE or SUSPENDED; a suspended carrier cannot book or reschedule, an unregistered one can. | `carrier.Carrier` |
| CPT | Critical pull time: the fleet's outbound cutoff, which the network uses as its pickup cutoff. | `consumed from process-path-management` |

## `yard-management`

| Term | Definition | Code |
| --- | --- | --- |
| Yard | The enclosed area outside a site's four walls: gate, parking spots and dock doors. | `-` |
| Yard Visit | One tractor and driver passing the gate, from check-in to check-out. | `yardvisit.Visit` |
| Trailer | Any towable unit on site, including a container on a chassis (SAP calls it a transportation unit). | `trailer.Trailer` |
| Spot | A Yard location (facility-layout role Yard) a trailer parks on. | `shared.Location` |
| Holding Spot | A spot for walk-ins and early arrivals, named in the yard policy. | `yardpolicy.Policy` |
| Dock Door | A Dock location (facility-layout role Dock) with a dockFlow of Inbound, Outbound or Both. | `shared.Location` |
| Live Load / Live Unload | The tractor waits at the door while the trailer is worked. | `shared.Purpose` |
| Drop | The trailer is left in the yard and the tractor leaves without it. | `shared.Purpose` |
| Bobtail | A tractor without a trailer. | `shared.Purpose` |
| Hostler | Yard driver (also jockey, spotter, shunter) who moves trailers with a yard truck. | `yardmove.Performer` |
| Yard Move | An instruction to take one trailer to a spot or a door. | `yardmove.Move` |
| Door Work | Unloading or loading while a trailer is docked; WAITING, IN_PROGRESS, DONE. | `trailer.DoorWork` |
| Dwell | Time on site from gate-in to gate-out (per trailer: arrival to departure). | `trailer.Trailer` |
| Seal | The numbered seal on a trailer's doors; NONE, INTACT, APPLIED, VERIFIED, MISMATCH or BROKEN, with an optional ISO 17712 class. | `trailer.SealState` |
| Securing | The restraint or wheel chocks that hold a docked trailer to its door while it is worked; recorded by a person, released before the trailer leaves. | `trailer.Securing` |
| Classification | What a trailer carries that limits where it may stand: a hazard class, a UN number, a temperature-control need. | `trailer.Classification` |
| Yard Check | A yard audit reconciling observed trailers with the model. | `yardcheck.Check` |
| Detention | Carrier waiting time charged beyond the agreed free time; the free time is a site setting. | `yardpolicy.Policy` |
| Turn Time | Gate-to-gate minutes of a visit: VisitCheckedIn arrived_at to VisitCheckedOut departed_at (the on_site_minutes the event carries), reported per visit purpose with average, p50, p90 and maximum. | `report.TurnTime` |
| Percentile (p50 | Median and 90th percentile of a duration, given next to the average because an average hides the long tail; computed by Postgres percentile_cont. | `report.Percentile` |
| Detention Exposure | Share of trailers that departed in the window with a dwell strictly over a threshold (default 120 minutes, the two hour norm), plus the excess minutes. Exposure to a detention claim, not billing. | `report.DetentionExposure` |
| Exception Rate | Per site over a window: rejected visits over arrivals, seal exceptions per check-in, holds by reason and yard-check discrepancies. Null when the denominator is zero. | `report.ExceptionRates` |

