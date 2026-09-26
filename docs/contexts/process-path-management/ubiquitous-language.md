---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: ProcessPath, PathId, Capability, MatchPrefix, Direct, DestinationLocationRole, CycleTimeP95, Eligibility, CPTSchedule, Status — pulled from the domain code's own doc comments.
---

# Ubiquitous Language

The definitions below are pulled directly from the domain code's own doc
comments (`internal/domain/processpath/process_path.go`,
`internal/domain/cptschedule/cpt_schedule.go`,
`internal/domain/shared/shared.go` and
`internal/domain/shared/eligibility.go` in the source repository) — not
reinvented for this page.

| Term | Definition |
| --- | --- |
| **ProcessPath** | The aggregate root: the operator-configurable definition of one process path — its canonical identity, the path-id-family match rule downstream consumers use, and the capabilities a station/associate must hold to work it. Replaces what was, before this service existed, a static YAML file loaded once at boot by three other services; the schema is carried over field-for-field, a like-for-like data-model change, not a redesign. |
| **PathId** | The canonical identity of a process path (e.g. `"PICK"`, `"PACK"`, `"REBIN"`, `"SLAM"`). It is the SAME identity `fulfillment-execution`'s `task.Type`, `wes-work-planning`'s `WorkPool.PathId`, and `workforce-management`'s `PathPlan.PathId` all reference — this service is the one place that identity is *defined*, not just consumed. Kept as a plain string, not an enum, because the whole point of this service existing is that the valid set is operator-configurable, not compiled in. |
| **Capability** | A named qualification a station/associate must hold to work a process path (e.g. `"pick"`, `"pack"`, `"hazmat"`) — the exact same vocabulary `workforce-management`'s `Certification` and `fulfillment-execution`'s `Station.Capability` already use. This service does not invent a new vocabulary; it is the authoritative source for which capabilities a given path requires, carried here as a plain string rather than redefined. |
| **MatchPrefix** | The lower-case prefix downstream consumers match a caller-supplied id against: `id == matchPrefix` OR `id` starts with `matchPrefix + "-"` — **never** a bare substring match without the separator (a hypothetical `"picking-station"` must not match `"pick"`). Validated lower-case at construction time, never lower-cased *for* the caller, so persisted data is exactly what was validated. This distinction matters: a published-language lookup that defaults to exact matching against a bare canonical id passes synthetic test fixtures while rejecting every real caller-supplied value in production. |
| **Direct** | A structural fact about the path's routing shape, reserved for a future multi-hop topology rather than a day-to-day operational parameter. Immutable once set at `Define` time — never revisable via `Revise`. |
| **DestinationLocationRole** | An **optional** declaration of which facility-layout `LocationRole` a completed task on this path is destined for: `Drop`, `WorkCenter` or `Shipping`, or unset (the zero value, valid for most paths). Declarative routing intent only — this service never calls facility-layout to validate it. Immutable once set at `Define` time, like `Direct` ([ADR 0009](https://github.com/claudioed/process-path-management/blob/develop/docs/docs/adr/0009-destination-location-role-on-process-path.md)). |
| **CycleTimeP95** | The operator-declared p95 end-to-end cycle time from release into the path to manifest — a declared standard, not a measured value. Required and strictly positive (`ErrInvalidCycleTime` otherwise), revisable while Active; a Go duration string on the wire (`"2h0m0s"`) ([ADR 0010](https://github.com/claudioed/process-path-management/blob/develop/docs/docs/adr/0010-fulfillment-capability-contract.md)). |
| **Eligibility** | A value object declaring the rules a unit of work must satisfy to be routed to a path: `maxUnitsPerLine` (unset means unbounded; `1` declares a singles path), `requiredProductAttributes`, `excludedProductAttributes`, `nonSortable`. Every field optional; the empty value is fully permissive. Revisable while Active (ADR 0010). |
| **CPTSchedule / Cutoff / SiteId** | The second aggregate root: a site-scoped, recurring Critical Pull Time schedule, identified by `SiteId` (facility-layout's site vocabulary, not validated against it). A CPT is a property of a departure, not of a path, so it is modelled once per site. Holds an IANA `timezone` and one or more **Cutoffs** — `cptId` (unique within the schedule), `localTime` (`HH:MM`), `daysOfWeek` (`Mon`..`Sun`), `shipMethod`, and the `eligiblePathIds` that can make it. Revised wholesale, never partially (ADR 0010). |
| **Status (Active / Deactivated)** | The activation lifecycle of a `ProcessPath`. There is no "draft" state — a path is live the instant it is defined, since the whole purpose of this service is operators configuring paths that take effect immediately, not a review workflow. Deactivation is a one-way, idempotent transition — see the [Aggregate Design Canvas](./aggregate-design-canvas) for the full invariant. |

See the [Glossary](/glossary) for how these terms sit alongside every other
bounded context's vocabulary, and [Ubiquitous Language](/strategic-design/ubiquitous-language)
at the platform level for terms deliberately reused across contexts with
different meanings.
