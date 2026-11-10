---
paths:
  - "apis/**"
  - "docs/**"
  - "network/docs/**"
  - "storefront/docs/**"
  - "yard/docs/**"
  - "network/model/**"
  - "storefront/model/**"
  - "yard/model/**"
---

# Events: CloudEvents 1.0

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

## Events: CloudEvents 1.0 is MANDATORY

Every Kafka message any warehouse-systems service produces or consumes
(integration `warehouse.<ctx>.events` AND analytics `warehouse.<ctx>.analytics`)
is a CloudEvents 1.0 event in structured content mode. This is a hard fleet
rule, and every page on this site must document it that way:

- Never document a flat envelope (`event_id`/`event_type`/`occurred_at`/
  `source`/`data`), a dual-write/dual-read migration, an analytics
  `schema_version`, or an envelope toggle env var (`EVENT_ENVELOPE_MODE` is
  gone) as current behaviour. No "the AsyncAPI is the target, the wire is
  still flat" caveats — the wire IS CloudEvents.
- Wire format to show in examples: Kafka header
  `content-type: application/cloudevents+json; charset=UTF-8`; attributes
  `specversion=1.0`, `id` (UUID, stable across outbox redelivery),
  `source=/warehouse/<repo>`, `type`, `subject` (aggregate id), `time`
  (occurred-at, UTC), `datacontenttype=application/json`,
  `dataschema=urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>`;
  payload under `data`, unchanged.
- `type` = `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`
  (`wms` for the WMS-tier contexts facility-layout, inventory-storage,
  product-master, inbound-receiving, slotting-optimization and
  pick-face-replenishment, `wes` for every other context;
  wes-work-planning's segment is `work-planning`). The segment is a fixed
  contract label, not an industry category: `wms` = item, location and
  inventory masters plus the contexts that keep stock in place (receiving,
  slotting, replenishment); `wes` = everything else. Never rename it; the
  industry category of each context lives on the WMS & WES pages.
  Breaking payload
  change => new `.v2` type + new dataschema version.
- Consumers dispatch on the FULL `type`, ignore unknown types, dedupe on
  `id`, and DLQ/skip (never parse a legacy shape) anything that fails
  CloudEvents validation.
- `apis/<ctx>/asyncapi.yaml` here are COPIES: fix envelope drift in the
  owning service repo, then re-sync — never hand-edit the copy.

Full standard, subdomain table and the fleet's cross-service type
catalogue: `docs/strategic-design/event-standard-cloudevents.md`. Each of
the nineteen Kafka-using service repos documented here also records it as its
own ADR (under docs/docs/adr/, or docs/adr/ for network-fulfillment,
warehouse-planning, product-master, inbound-receiving, slotting-optimization, pick-face-replenishment, task-interleaving and outbound-shipping (its ADR 0005) — product-master's is ADR 0004;
network-inventory-planning's is ADR 0004 under docs/docs/adr/);
`warehouse-ops-agent` uses no Kafka.
