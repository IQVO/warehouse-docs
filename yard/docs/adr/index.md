---
id: index
title: ADRs
sidebar_label: ADRs
description: "Design decisions of the yard domain (YD-0001 to YD-0005, mirrored in model.yaml) and the implementation ADRs of the dock-scheduling and yard-management services, with Status and a link to each on develop."
---

# ADRs

The design decisions of the yard domain (YD), then the implementation ADRs of the two built services. Each service ADR lives in its own repo; the tables below (dock-scheduling 10, yard-management 11) copy the Status from the ADR body (first sentence) and link the file on `develop`. ADR bodies are immutable; read them in their repo.

## Yard design decisions (YD)

| ADR | Decision |
| --- | --- |
| [YD-0001](/yard/adr/yd-0001-two-contexts) | Two bounded contexts: dock-scheduling and yard-management |
| [YD-0002](/yard/adr/yd-0002-appointment-ownership) | DockAppointment moves from inbound-receiving to dock-scheduling |
| [YD-0003](/yard/adr/yd-0003-every-location-change-is-a-move) | Every location change of a trailer is a YardMove |
| [YD-0004](/yard/adr/yd-0004-physical-facts-win) | Physical facts win: arrival, docking and door release are recorded only by yard-management |
| [YD-0005](/yard/adr/yd-0005-pickups-from-cpt) | Outbound pickups come from the fleet CPT schedule, never from the retail network |

## dock-scheduling

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0001-dock-scheduling-bounded-context.md) | Dock Scheduling is a bounded context of the yard domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0002-aggregates-invariants-and-assumptions.md) | Aggregates, invariants, error names and assumptions | Accepted. |
| [0003](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0003-consumed-contracts-and-local-copies.md) | Consumed contracts and local copies | Accepted. |
| [0004](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0004-cloudevents-catalogue.md) | CloudEvents catalogue | Accepted. |
| [0005](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0005-postgres-persistence-and-outbox.md) | Postgres persistence and the transactional outbox | Accepted. |
| [0006](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0006-analytics-read-side.md) | Analytics read side: an analytics stream, a projector and a schedule-adherence report over a separate analytical database | Accepted (2026-11-06). |
| [0007](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0007-mcp-server.md) | MCP server | Accepted. |
| [0008](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0008-rest-adapter-and-api-composition-root.md) | REST adapter and the API composition root | Accepted. |
| [0009](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0009-kafka-consumers.md) | Kafka consumers | Accepted. |
| [0010](https://github.com/IQVO/dock-scheduling/blob/develop/docs/adr/0010-door-reassigned-is-an-integration-event.md) | DockAppointmentDoorReassigned is an integration event | Accepted (2026-11-09). |

## yard-management

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0001-yard-management-bounded-context.md) | Yard Management is a bounded context of the yard domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0002-aggregates-invariants-and-assumptions.md) | Aggregates, invariants and assumptions | Accepted (2026-11-05). |
| [0003](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0003-consumed-contracts-and-local-copies.md) | Consumed contracts and local copies | Accepted (2026-11-05). |
| [0004](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-11-05); stream split refined by ADR 0010 (DoorWorkCompleted and TrailerDeparted also on the integration topic). |
| [0005](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0005-postgres-persistence-and-outbox.md) | Postgres persistence and the transactional outbox | Accepted (2026-11-06). |
| [0006](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0006-analytics-read-side.md) | Analytics read side: an analytics stream, a projector and yard reports over a separate analytical schema | Accepted (2026-11-06); refined by 0011 (the projector folds twelve kinds, not seven; new reports). |
| [0007](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0007-mcp-server.md) | MCP server | Accepted (2026-11-06). |
| [0008](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0008-rest-adapter-and-api-process.md) | The REST adapter and the API process | Accepted (2026-11-06). |
| [0009](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0009-kafka-consumers.md) | Kafka consumers | Accepted (2026-11-06). |
| [0010](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0010-door-work-and-departure-on-the-integration-topic.md) | DoorWorkCompleted and TrailerDeparted on the integration topic | Accepted (2026-11-09). |
| [0011](https://github.com/IQVO/yard-management/blob/develop/docs/adr/0011-kpi-standard-reports.md) | Yard KPI standard v1: turn time, detention exposure and exception rates | Accepted (2026-11-09). |
