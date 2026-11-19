---
id: industry-reference
title: WCS - the industry reference
sidebar_label: Industry reference
description: What a warehouse control system is, owns and does not own, quoted from MHI, Wikipedia, Logistics Management, Dematic, Swisslog, SSI Schaefer, Honeywell Intelligrated, enVista, Fortna, BEUMER, VDA 5050, OPC UA (ISA-95, PackML), MassRobotics, SAP EWM, VDI and Bartholdi and Hackman.
---

# WCS - the industry reference

This page records what the industry means by a **warehouse control system**
before the [subdomains](/wcs/subdomains) and contexts are drawn. It extends the
fleet's [WMS, WES and WCS reference](/wms-wes/industry-reference), which already
quotes MHI, KNAPP, Interact Analysis and Modern Materials Handling on the stack.
Every quote below was read on the page or PDF listed under
[Sources](#sources), on 2026-11-19.

:::note[Scope of the research]
Sources: an industry association (MHI), an encyclopedia (Wikipedia), the trade
press (Logistics Management), automation vendors (Dematic, Swisslog, SSI
Schaefer, Honeywell Intelligrated, enVista, Fortna, BEUMER), standards bodies
(VDA, the OPC Foundation, MassRobotics, VDI), a WMS vendor's material flow
documentation (SAP) and a textbook (Bartholdi and Hackman). O'Reilly titles were
searched through the O'Reilly catalogue, which returned metadata only, so they
are listed as [further reading](#further-reading-oreilly) and no claim on this
page rests on them. Vendor pages describe products; their claims are marked as
vendor claims where it matters.
:::

## What a WCS is

The sources agree on the core definition: software that controls automated
material handling equipment in real time.

- Wikipedia: "a software application that directs the real-time activities
  within warehouses and distribution centers".[S2]
- BEUMER: "software that manages the real-time control of automated materials
  handling systems and equipment".[S3]
- MHI: "WCS is often the middle layer between automation and a company's
  enterprise resource planning" and "A WCS helps your operations make decisions
  at the device level."[S1]

## What a WCS owns

| Function | What the sources say |
| --- | --- |
| Routing and divert | "Routing decisions – determining which conveyor or sorter path each item should follow."[S3] The WCS will "Dynamically assign cartons to divert locations based on defined sortation algorithms".[S2] It "Coordinates the movement of cartons from source to destination".[S11] |
| Subsystem coordination | "Our WCS translates decisions into precise commands for subsystems (conveyors, shuttles, sorters, AS/RSs, etc.)".[S5] Devices named: "Scanners, Print-and-Apply, Scales, Robotics, ASRS, AMRs, Put-To-Light, Pick-To-Light, GTP Systems".[S9] |
| PLC communication | "A WCS can communicate with and direct the programmable logic controllers on the equipment."[S1] It works by "connecting directly to programmable logic controllers (PLCs) that drive automation hardware".[S3] |
| Exceptions | "Exception handling – managing issues such as jams, errors, or mis-routes."[S3] An unidentified handling unit "should be transferred to a Clarification Point".[S16] |
| Alarms and supervision | "Includes alarm monitoring, fault detection and centralized trace logging".[S9] "Real-time status, warning and alarm monitoring".[S11] |
| Pacing | Historically the WCS broke "that big wave into packets of work", and "we use the unit sorter to set the pace".[S4] |

What it does **not** own is inventory. Wikipedia lists the question an
implementation must settle: "Define responsibilities between WCS and WMS (who
owns the inventory?)".[S2] No source gives the WCS the stock ledger.

## Where a WCS ends

### Above: the WMS and the WES

- The WCS "provides the critical link between the non-real time based host and
  the real-time MHE control system".[S2]
- "The WMS sets overall priorities, while the WCS executes them at the equipment
  level."[S3]
- "The WMS would tell us where to send the product that was on the equipment",
  and "It was up to the WCS to figure out the best route to get there".[S4] The
  host chooses the destination; the WCS chooses the route.
- enVista separates the two tiers: the WES "Orchestrates workflows and resource
  usage" and "Determines when and where tasks are executed", while the WCS
  "Sends real-time instructions to automation equipment via PLCs".[S9]

### Below: PLCs and machines

- Equipment controllers are "typically some form of a programmable logic
  controller (PLC) or a dedicated, real-time PC control system".[S2]
- The PLC has "Direct control over equipment (motors, sorters, drives,
  solenoids, scanners)" and "Millisecond-level communication with WCS".[S9]
- The historical reason the layer exists: "The PLC didn't have memory to hold a
  database, and it couldn't make a real-time decision".[S4]

### Time horizon

- "a high-speed sorter couldn't wait while we accessed a host system".[S4]
- The WMS "was never built to manage real-time execution of automation that
  requires decision-making measured in milliseconds".[S10]
- ISA-95 level 2: "automation and control systems have real-time responses
  measured in sub-seconds".[S13]
- enVista claims "sub-250 millisecond response times" (a vendor claim).[S9]

## The layer's internal structure

The European market names the layer a **material flow system** or **material
flow controller**, and several sources split it into a coordinating layer over
subsystem controllers.

- "Material flow systems sit between the warehouse management system (WMS) and
  the device controller (PLC)." The MFS "coordinates and optimizes the sequence
  of work steps" and "issues travel commands to the PLCs for machines".[S7]
- "Beyond Europe, the Material Flow System (MFS) is often also called Warehouse
  Control System (WCS)."[S7] "In the North American market, the term 'WCS' refers
  to a European MFS (Material Flow System)."[S8]
- Swisslog splits the layer in three: "WCS has evolved as a bridge between WMS
  and MFC or lower-level control or PLC systems"; the "MFC is a specialized
  on-the-ground traffic controller"; and "SCADA sits closest to the equipment
  layer", "generally built as a standalone system for equipment
  maintenance".[S6]
- SAP EWM's material flow system gives the vocabulary of the seam to the PLC:
  "The point where EWM and PLC communicate is called the communication point";
  "Common communication points are I-points (identification point) or scanner
  points"; the PLC's message "is called a telegram"; a handshake "defines if a
  PLC confirms the receipt of a telegram"; and "The distance between two
  communication points can be modeled as a conveyor segment".[S16]

## Interface standards

| Standard | What it covers | Relevance to this design |
| --- | --- | --- |
| **VDA 5050 v3.0.0**[S12] | "a standardized and vendor-neutral communication interface between a fleet control system and mobile robots", over "MQTT … in combination with a JSON format". Topics: `order`, `instantActions`, `state`, `visualization`, `connection`, `factsheet`, `zoneSet`, `responses`. "The core of a transport order is a node-edge-graph segment"; "The set of released nodes and edges are called the 'base'. The set of unreleased… 'horizon'." Fleet control does "Assignment of orders to the mobile robots", "Detection and resolution of blockages ('deadlocks')" and "Traffic control"; the robot does "Localization", "Execution of actions" and "Continuous transmission of its status". | The protocol between `amr-fleet-control` and the robots. It excludes "Traffic Management Logic" and "interfaces to peripheral equipment, infrastructure components, or external IT systems", so the fleet-side logic and the WES seam are this design's to define. |
| **MassRobotics AMR Interoperability Standard**[S15] | It "isn't a fleet management, vehicle navigation, or safety system"; it shares location, destination, ID, operational state and speed between fleets, and it and VDA 5050 are "not conflicting protocols". | Not needed for one fleet. Relevant only if a second robot vendor joins. |
| **ISA-95 / IEC 62264** (OPC 10030 summary)[S13] | Level 1: "the sensors and actuators attached to the control functions". Level 2: "real-time responses measured in sub-seconds". Level 3: "days, shifts, hours, minutes, and seconds". | Places the WCS at level 2 and the fleet's WMS and WES at level 3. |
| **PackML** (ANSI/ISA-TR88.00.02 via OPC UA)[S14] | A machine state model: Idle ("error-free state, waiting to start"), Execute, Held ("waiting for internal process conditions to clear"), Suspended ("waiting for external process conditions to clear"), Complete, Resetting and others. | The equipment state vocabulary for shuttles, lifts and robots in this design. |
| **VDI 3601**[S17] | The German guideline for WMS: "subordinate systems provide throughput, data quality and stability". | Confirms the WMS treats the WCS as a subordinate system. |

No public standard was found for the telegram protocol between a WCS and an
AS/RS PLC; vendors use their own. This design therefore defines a small
fleet-owned telegram protocol modelled on SAP EWM's telegrams and handshake (see
[open questions](/wcs/implementation-handoff#open-questions)).

## Where the sources disagree

| Question | Disagreement | This design's position |
| --- | --- | --- |
| Does routing belong to the WES or the WCS? | Fortna: "WCS has focused primarily on the management of automation, decisions related to routing, and other low-level controls. Today, these functions are an integral part of WES."[S10] Dematic and enVista keep the tiers separate.[S5][S9] | Routing stays in the WCS. The fleet's WES is an *embedded* WES that sits above the WCS (see the [qualification](/wms-wes/qualification)), and keeping routing below the seam keeps equipment vocabulary out of the WES. |
| What does "WCS" name? | A European WCS can be a hybrid of MFS and WMS; a North American WCS equals a European MFS.[S8] Swisslog places the WCS above the MFC;[S6] SSI Schaefer equates the two.[S7] | One tier, the WCS, split into a material flow controller (`material-flow-control`) and subsystem controllers (`amr-fleet-control`, `asrs-control`). |
| Is SCADA inside the WCS? | Swisslog keeps it separate, for maintenance;[S6] enVista includes it.[S9] | Each subsystem context publishes its own equipment state; no separate SCADA context in the first phase. |
| Which ISA-95 level is a WCS? | Its time scale matches level 2;[S13] some product WCSs also cover level-3 functions such as work release.[S4] | Level 2. Work release stays in the WES (`wes-work-planning`). |

## Sources

- **[S1]** [MHI Solutions Community, "What is WCS?" (2023)](https://www.mhi.org/blog/126051/what-is-wcs)
- **[S2]** [Wikipedia, "Warehouse control system"](https://en.wikipedia.org/wiki/Warehouse_control_system)
- **[S3]** [BEUMER Group, "Glossary: Warehouse Control System (WCS)"](https://www.beumergroup.com/knowledge/wd/glossary-warehouse-control-system-wcs/)
- **[S4]** [Bob Trebilcock, "Big Picture: Evolution of the WCS", Logistics Management (2011)](http://www.logisticsmgmt.com/article/big_picture_evolution_of_the_wcs)
- **[S5]** [Dematic, Software](https://www.dematic.com/en/software)
- **[S6]** [Swisslog, "Software: The intelligent driver behind warehouse automation"](https://www.swisslog.com/nl-nl/products-systems-solutions/software)
- **[S7]** [SSI Schaefer, "Real-Time Material Flow Control, from Goods-in to Goods-out"](https://ssi-schaefer.com/en-de/-real-time-material-flow-control-from-goods-in-to-goods-out-1066380)
- **[S8]** [SSI Schaefer, WAMAS WCS](https://www.ssi-schaefer.com/en-ca/software/wamas-software-solutions/wcs-warehouse-control-system)
- **[S9]** [enVista, enMotion WCS brochure (2025)](https://web.envistacorp.com/hubfs/Brochure_enMotion-WCS.pdf)
- **[S10]** [Fortna, "WES: the evolving tech stack" white paper (2020)](https://www.fortna.com/wp-content/uploads/2020/12/TL-WES2-evolving-tech-stack-1r-EN.pdf)
- **[S11]** [Honeywell Intelligrated, Momentum Machine Control Business Logic](https://automation.honeywell.com/us/en/software/warehouse-automation/momentum-machine-control-business-logic)
- **[S12]** [VDA, VDA 5050 Version 3.0.0 (PDF)](https://www.vda.de/dam/jcr%3A09f03b91-13e2-4db3-bf30-4f221710071b/VDA5050-V3.0.0-2025-03.pdf)
- **[S13]** [OPC Foundation, OPC 10030 ISA-95 companion specification, 4.2 ISA-95 Summary](https://reference.opcfoundation.org/specs/OPC-10030/4.2)
- **[S14]** [OPC Foundation, OPC UA PackML companion specification v1.00, 6.3.8](https://reference.opcfoundation.org/v104/PackML/v100/docs/6.3.8)
- **[S15]** [Kap Choi, "What Is the MassRobotics AMR Interoperability Standard?", MassRobotics (2023)](https://www.massrobotics.org/what-is-the-massrobotics-amr-interoperability-standard/)
- **[S16]** [SAP Learning, "Controlling the Material Flow System (MFS)", SAP S/4HANA EWM](https://learning.sap.com/courses/processes-in-sap-s-4hana-ewm/controlling-the-material-flow-system-mfs)
- **[S17]** [VDI 3601 "Warehouse management systems" (2015)](https://vdi.de/en/home/vdi-standards/details/vdi-3601-warehouse-management-systems)
- **[S18]** [Bartholdi and Hackman, Warehouse and Distribution Science v0.98, Georgia Tech (PDF)](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf)

Bartholdi and Hackman have no WCS chapter. They give orchestration to the WMS
("the WMS orchestrates the flow of people, machines, and product") and note that
sortation "requires scanning technologies… and significant IT support for
real-time control".[S18]

## Further reading (O'Reilly)

Found in the O'Reilly catalogue; their text was not read for this page.

- Gwynne Richards, *Warehouse Management*, 5th edition (Kogan Page, 2025)
- Peter Devenyi, Miguel Pinilla and Jim Stollberg, *The Warehouse Revolution*
  (Business Expert Press, 2024)
- Edward Frazelle, *World-Class Warehousing and Material Handling*, 2nd edition
  (McGraw-Hill, 2016)
- CSCMP, *The Definitive Guide to Warehousing* (Pearson, 2013)
- Vlad Khononov, *Learning Domain-Driven Design* (O'Reilly, 2021)
- Eric Evans, *Domain-Driven Design* (Addison-Wesley, 2003)
- Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley, 2013)
- Matthew Skelton and Manuel Pais, *Team Topologies* (IT Revolution, 2023
  edition)
- Susanne Kaiser, *Architecture for Flow* (Addison-Wesley, 2025)
