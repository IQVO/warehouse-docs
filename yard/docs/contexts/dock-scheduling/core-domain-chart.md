---
id: core-domain-chart
title: Core Domain Chart
sidebar_label: Core Domain Chart
description: "Where Dock Scheduling sits on the ddd-crew Core Domain Chart and why it is a Supporting subdomain."
---

# Core Domain Chart

:::info[Built on develop, not deployed]
Built on develop (merged 2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling), not deployed: registered nowhere in warehouse-infra. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

Following the ddd-crew [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts):
business differentiation (y) against model complexity (x).

```mermaid
quadrantChart
    title dock-scheduling on the Core Domain Chart
    x-axis Low model complexity --> High model complexity
    y-axis Low business differentiation --> High business differentiation
    quadrant-1 Core
    quadrant-2 Decisive - Short-term Core
    quadrant-3 Supporting
    quadrant-4 Generic
    dock-scheduling: [0.45, 0.40]
    No-overlap door booking: [0.48, 0.42]
    ETA risk and no-show: [0.36, 0.34]
    Adherence report: [0.28, 0.26]
```

Derived from: `model.yaml → contexts[dock-scheduling].chart`
(`complexity: 0.45`, `differentiation: 0.40`, `evolution: Product`),
`.aggregates[DockAppointment]`, `.aggregates[DockCalendar]`,
`.policies[EtaRisk, NoShowSweep]`, `.read_models[AdherenceReport]`.

Omitted: the other contexts (their points are on their own charts). The three
internal slices are this pack's reading of the model, not values from
`model.yaml`; all of them stay in quadrant 3.

## Classification: Supporting

The context point sits in **quadrant 3 (Supporting)**: below and left of the
centre. The model classifies it `Supporting`, business model *Cost reducer
(carrier wait, detention, idle dock labour) and revenue protector (on-time
inbound)*.

**Differentiation is moderate to low (y = 0.40).** The model's roles are
Specification (the door calendar), Gateway for carriers (Open Host Service)
and Analysis (adherence). The calendar is needed by every site that has doors,
and the fleet does not win by how it books a door. What it protects is a
cost, carrier wait and idle dock labour, and the on-time arrival of inbound
stock. The highest slice is the no-overlap door booking, because it is the
one rule that two organisations (carriers and the site) both feel when it
fails.

**Model complexity is moderate (x = 0.45).** Two aggregates (`DockAppointment`
with five states and ten transitions, `DockCalendar` with a single state),
sixteen invariants and ten policies. The hard parts are cross-cutting more
than structural: one rule over a door's whole calendar under a per-door
advisory lock, four checks against event-fed copies (doors, ASNs, cutoffs and
the calendar itself), and physical facts that arrive out of order from
`yard-management`. The adherence report is plain counting and plotted lowest.

## Evolution

The model sets the context's evolution stage to **Product**. The slices below
are this pack's reading.

| Part | Evolution stage (reading) | Why |
| --- | --- | --- |
| No-overlap door booking and calendar | **Product** | The model puts the context at this stage; a product could replace it if it published the same events and honoured the same invariants. |
| Applying yard facts (`ArrivalFromGate`, `ActualDoorWins`, `OutOfOrderYardFacts`) | **Custom-built** | Specific to the fleet's two-context split between the future and the present of a door. |
| ETA risk and no-show sweep | **Custom-built** | Small rules over the site's own tolerance and grace settings. |
| Plumbing (outbox, inbox, CloudEvents) | **Commodity** | The same building blocks as every context (`conventions.integration_rules`). |

**Movement to watch.** The model names a future context,
`transport-visibility`, that would feed `ReportEta` with real-time ETAs.
Nothing in the model makes ETA risk more than an advisory today (nothing
reschedules automatically), so the slice stays Supporting; if an ETA feed
started to drive rescheduling, the ETA slice would move up and right. The
industry basis for these placements is on [benchmarks](/yard/research/benchmarks).
