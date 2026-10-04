---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: ProcessCapacity, CapacityConstraint, CapacityRate, CapacityWindow, WorkloadProfile, ProcessPath, StationStandard, Station count, Site, ProcessPathCapacity, CapacityPlan, Bottleneck — from the repository's own domain-model rules.
---

# Ubiquitous Language

The definitions below come from this context's own
`.claude/rules/domain-model.md` and its ADRs
([0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md),
[0002](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0002-station-capacity-composition.md),
[0003](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0003-window-coverage-semantics.md)),
not reinvented for this page.

| Term | Definition |
| --- | --- |
| **ProcessCapacity** | The usable throughput of one warehouse process at one location for one time window; the minimum across its registered constraints. An aggregate, identified by `(ProcessType, Location, CapacityWindow)`. |
| **CapacityConstraint** | One named limiting factor (type + rate) attached to a ProcessCapacity. Types: `LABOR`, `LOCATION`, `EQUIPMENT`, `STATION`, `CONVEYOR`, `BUFFER`, `REPLENISHMENT`. |
| **CapacityRate** | A quantity + native unit + period, e.g. `4000 UNIT / HOUR`. Never compared across differing units without going through a WorkloadProfile first. |
| **CapacityWindow** | The `[start, end)` period a capacity value is valid for; a capacity number with no window is incomplete by definition. A window `C` **covers** a planning window `W` when `C.start <= W.start` and `C.end >= W.end` (a window covers itself) — the rule by which a registered constraint applies to a requested window (ADR 0003). The window is also part of the ProcessCapacity's identity, which stays an exact key. |
| **WorkloadProfile** | The per-warehouse conversion factors (units per order, packages per order) used to normalize different processes' native rates into one comparable flow unit. Today carried on the request, not persisted. |
| **ProcessPath** | An ordered sequence of process types a workload must flow through (e.g. Pick → Rebin → Pack). **Locally owned by this context** and operator-declared via `POST /process-paths` — not a Conformist copy of `process-path-management`'s aggregate, which carries no physical step sequence. The two share the `path_id` string only as a loose human cross-reference. |
| **StationStandard** | The operator-declared throughput of **one** station of a process at a site, keyed `(location, process type)` and valued as a CapacityRate in the process's natural unit (e.g. `180 PACKAGE / hour` for PACK at `SIM1`). A planning parameter owned by this context; no upstream publishes it. |
| **Station count** | How many work-center stations `facility-layout` tallied for an activity across the zones of a site. A count has no throughput of its own — only `count x StationStandard` does. |
| **Site / location** | A planning `location` is a site (building) code such as `SIM1`: the labor consumer's `building_id` and the first dash-separated segment of the facility zone ids of that site (`SIM1-OPS-WC`). A zone whose id has no matching site contributes nothing. |
| **ProcessPathCapacity** | The normalized, end-to-end throughput of a ProcessPath: the minimum of its steps' effective capacities after WorkloadProfile normalization, plus which step is the bottleneck and which constraint type binds it. A domain service result, not a stored aggregate. |
| **Step composition** | For a path step with process `P` at location `L` and window `W`: candidates are the constraints of the covering ProcessCapacity aggregates (per constraint type the latest window start wins) plus a **derived STATION constraint** `stationCount(L, P) x StationStandard(L, P)`; every candidate is normalized to orders per hour, the minimum is the step's rate, and the binding constraint type is reported. Stations with no declared standard produce a warning, never an invented throughput. |
| **CapacityPlan** | The aggregate that ties assigned demand for a location and planning window to the ProcessPathCapacity available to serve it, and the resulting shortage (if any). Lifecycle: `DRAFT` → `PUBLISHED`. |
| **Shortage** | `max(0, assigned demand - capacity over window)`; never negative. Demand exactly equal to capacity is not a shortage. |
| **Bottleneck** | The constraint or process-path step currently limiting end-to-end flow. |

`ProcessCapacityRegistered` and `ProcessCapacityChanged` exist as domain
vocabulary only — nothing raises or publishes them yet.

See the [Glossary](/glossary) for how these terms sit alongside every other
bounded context's vocabulary, and
[Ubiquitous Language](/strategic-design/ubiquitous-language) at the platform
level — "Process Path" is one of the documented same-word, different-model
cases.
