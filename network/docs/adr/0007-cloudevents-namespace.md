---
id: 0007-cloudevents-namespace
slug: /adr/0007-cloudevents-namespace
title: "7. CloudEvents namespace com.retailnetwork, no shared topic"
sidebar_label: "7. CloudEvents namespace com.retailnetwork, no shared topic"
sidebar_position: 8
description: "Every network event is CloudEvents 1.0 with type com.retailnetwork.<tier>.<context>.<entity>.<Event> on retailnetwork.<context>.events; no topic is shared with the fleet."
---

# 7. CloudEvents namespace com.retailnetwork, no shared topic

## Status

**Proposed** (2026-10-22).

## Context

The fleet mandates CloudEvents 1.0 on every Kafka message with types
`com.warehouse.<subdomain>.<context>...`. The network is a different
organization. Reusing `com.warehouse` would invite a fleet consumer to
subscribe to a network topic, which breaks the hard boundary.

## Decision

- `type`: `com.retailnetwork.<tier>.<context>.<entity>.<EventName>`, tiers
  `commerce`, `logistics`, `partner`.
- `source` `/retailnetwork/<context>`, `dataschema`
  `urn:retailnetwork:<context>:events:<EventName>:v1`, `subject` and Kafka key
  = the aggregate id.
- Topics `retailnetwork.<context>.events` and `.analytics`.
- The same delivery rules as the fleet: transactional outbox, idempotent
  consumers, dispatch on the full type string.

## Consequences

- A gate (`scripts/check_model.py --pages`) rejects any page printing a type
  whose tier, context or event disagrees with the model.
- The fleet and the network can share a Kafka cluster in a local kind
  deployment without any risk of cross-consumption by name.
