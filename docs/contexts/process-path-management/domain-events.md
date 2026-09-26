---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: ProcessPathCreated, ProcessPathUpdated, ProcessPathDeactivated, CPTScheduleChanged — when each is published, and who consumes them today.
---

# Domain Events

Four past-tense, business-meaningful events, all published on
`warehouse.process-path-management.events` (path events keyed by
`path_id`, `CPTScheduleChanged` keyed by `site_id`), and (since ADR 0007)
fanned out a second time onto the separate analytics topic
`warehouse.process-path-management.analytics`. See the
[Aggregate Design Canvas](./aggregate-design-canvas) for the commands that
trigger them and [Async API](./async-api) for the wire envelope.

| Event | When published | Consumed by |
| --- | --- | --- |
| **ProcessPathCreated** | A new `ProcessPath` is successfully defined via `Define` | `fulfillment-execution`, `wes-work-planning`, `workforce-management`, `order-management` (integration topic, live); this context's own `cmd/pathmgmt-projector` (analytics topic, live) |
| **ProcessPathUpdated** | A `Revise` call actually changes `MatchPrefix`, `RequiredCapabilities`, `CycleTimeP95` or `Eligibility` (never published for a byte-for-byte-identical revision) | Same as above |
| **ProcessPathDeactivated** | A `ProcessPath` transitions from `Active` to `Deactivated` (never republished on a redundant deactivate call against an already-deactivated path); payload carries only `path_id` | Same as above |
| **CPTScheduleChanged** | `DefineCPTSchedule` first defines a site's CPT schedule, or a revision actually changes it; carries the full schedule snapshot, not a diff (ADR 0010) | `order-management` only (integration topic, live). The three WES-tier consumers ignore it; the analytics projector ignores it too |

## The honest state of consumption

`fulfillment-execution`, `wes-work-planning`, and `workforce-management`
are this context's three original Conformist consumers on the integration
topic — each previously boot-loaded the process-path catalogue from a
static YAML file this service replaced. All three now have a live Kafka
consumer wired (ADR 0002; verified: a newly-defined path reached all three
running consumers with no restart, and a deactivation propagated the same
way). Their binaries still default to `PATH_CATALOGUE_SOURCE=file`;
`warehouse-infra` sets `kafka`. They decode the `ProcessPath*` events
only — none of them reads `destination_location_role`,
`cycle_time_p95`/`eligibility`, or `CPTScheduleChanged` today.

`order-management` is the fourth Conformist consumer (ADR 0010): two
separate consumers on the same topic — a catalogue consumer decoding each
path's `cycle_time_p95` and `eligibility`, and a CPT-schedule consumer
decoding `CPTScheduleChanged` — from which it derives its delivery
promise. Its binary defaults to `PATH_CATALOGUE_SOURCE=none`;
`warehouse-infra` sets `kafka`. See the
[Bounded Context Canvas](./bounded-context-canvas) and the platform-level
[Context Map](/strategic-design/context-map) for the full picture.

The analytics topic's one consumer, this context's own
`cmd/pathmgmt-projector`, is also live (it projects the three
`ProcessPath*` event types and ignores `CPTScheduleChanged`) — see
[Bounded Context Canvas](./bounded-context-canvas)'s Outbound
Communication for the analytics data product this feeds.

## What consumers do once wired

- Maintain their own local read model/cache derived from this event
  stream, rather than reading a live value from this service on every
  dispatch decision.
- Treat `ProcessPathDeactivated` as "stop accepting new work against this
  path", never as a command to cancel work already in flight.
- Never need to diff an unchanged payload: `ProcessPathUpdated` is only
  published when a `Revise` call produces a real change.
