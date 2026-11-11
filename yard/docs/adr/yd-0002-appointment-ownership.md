---
id: yd-0002-appointment-ownership
title: "YD-0002: DockAppointment moves from inbound-receiving to dock-scheduling"
sidebar_label: "YD-0002"
description: "One owner of door time for both directions; staged strangler migration."
---

# YD-0002: DockAppointment moves from inbound-receiving to dock-scheduling

## Status

Accepted (2026-11-05): decisions confirmed by the owner the same day; built in both services on develop (merged 2026-11-08); both are registered in warehouse-infra develop (apps.yaml entry, helm values, image pinned at v0.1.2), released at v0.1.2 and applied to the k3s cluster on 2026-11-10 (reduced footprint). Stage E is done on develop for the migration code (2026-11-10): `dock-scheduling` removed the stage A legacy importer (its ADR 0011) and `inbound-receiving` removed the stage B `republish-appointments` backfill, the legacy `dockappointment` encoders and `Replay` (its ADR 0022). The deprecated appointment reads and the three 410 `appointment-moved` write routes of `inbound-receiving` are not removed: they stay pending a decision (its ADR 0022).

## Context

`inbound-receiving` owns an inbound-only `DockAppointment`. A door whose `dockFlow` is `Both` would have two owners of its time if outbound appointments lived elsewhere, and the no-overlap invariant cannot span two databases.

## Decision

`dock-scheduling` owns `DockAppointment` for both directions. Migration stages: A the new owner runs a legacy importer; B the old owner backfills through its outbox; C the old owner's write routes answer 410 `appointment-moved` and a local copy fed by the new owner's events backs `Receipt.Open`; D readers (`warehouse-planning`) switch source and reject the old mode at boot; E decommission after cluster verification. Event names and payload fields are kept as a superset, adding `site_id`, `direction` and `version`.

## Consequences

`warehouse-planning` gains the site it could not see (its ADR 0017 limitation). Closing a receipt no longer completes the appointment; yard door release does.

The stage A importer never ran: on 2026-11-10 the cluster showed `DOCK_LEGACY_IMPORT_CONSUMER_GROUP` unset, an empty appointment copy in `inbound-receiving` and no message on `warehouse.inbound-receiving.events` (dock-scheduling ADR 0011, inbound-receiving ADR 0022), so no appointment was imported and removing the importer lost nothing. `dock-scheduling` consumes no `dockappointment.*` type from `inbound-receiving` any more, only its two ASN events; `inbound-receiving` no longer publishes the four legacy types. The `legacy-import` provenance value stays in the published appointment view as a historical value that nothing sets.
