---
id: yd-0002-appointment-ownership
title: "YD-0002: DockAppointment moves from inbound-receiving to dock-scheduling"
sidebar_label: "YD-0002"
description: "One owner of door time for both directions; staged strangler migration."
---

# YD-0002: DockAppointment moves from inbound-receiving to dock-scheduling

## Status

Accepted (2026-11-05): decisions confirmed by the owner the same day; built in both services on develop (merged 2026-11-08), not deployed.

## Context

`inbound-receiving` owns an inbound-only `DockAppointment`. A door whose `dockFlow` is `Both` would have two owners of its time if outbound appointments lived elsewhere, and the no-overlap invariant cannot span two databases.

## Decision

`dock-scheduling` owns `DockAppointment` for both directions. Migration stages: A the new owner runs a legacy importer; B the old owner backfills through its outbox; C the old owner's write routes answer 410 `appointment-moved` and a local copy fed by the new owner's events backs `Receipt.Open`; D readers (`warehouse-planning`) switch source and reject the old mode at boot; E decommission after cluster verification. Event names and payload fields are kept as a superset, adding `site_id`, `direction` and `version`.

## Consequences

`warehouse-planning` gains the site it could not see (its ADR 0017 limitation). Closing a receipt no longer completes the appointment; yard door release does.
