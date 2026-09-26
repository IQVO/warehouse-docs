---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for Facility Layout — purpose, strategic classification, domain roles, inbound/outbound communication, business decisions, assumptions, verification metrics, and open questions, stated honestly against what is actually wired today.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context
Canvas](https://github.com/ddd-crew/bounded-context-canvas) template.

:::info[Integration status: live]
`facility-layout` is a **live, wired Open Host Service**. Its Kafka
publisher emits every domain event to `warehouse.facility.events`
(`EVENT_PUBLISHER=kafka`, ADR-0009), the contract is a published
[`apis/asyncapi.yaml`](https://github.com/claudioed/facility-layout/blob/develop/apis/asyncapi.yaml),
and `inventory-storage` is a live Conformist consumer: it maintains a local
read model of location classifications fed by this topic
(`LOCATION_LOOKUP_MODE=kafka`, inventory-storage ADR-0013), replacing its
per-stow synchronous classification call. Verified in the running cluster
with facility-layout scaled to **zero replicas** — stows were still
classified correctly from the cache. `wes-work-planning` is now a live
**synchronous** Conformist too: it calls `GET /distance`
(`TRAVEL_DISTANCE_MODE=http`, enabled in the kind cluster).
`fulfillment-execution` has an opt-in `GET /locations/{locationCode}` role
lookup (`LOCATION_ROLE_MODE=http`) that the kind cluster does **not** enable
yet. Every consumer's mode defaults to `permissive` (no network). No
WES-tier context consumes the *events* yet. REST and MCP are
unauthenticated by deliberate decision
([ADR 0015](https://github.com/claudioed/facility-layout/blob/develop/docs/docs/adr/0015-remove-rest-mcp-auth.md)).
:::

## Name

**Facility Layout**

## Purpose

The system of record for **where things physically are in the building**:
the site's structural hierarchy (Site → Area → Zone → Aisle) and the coded
storage slots inside it. It owns whether a coded location **exists, is
active, and is legal for a given kind of storage unit** — the warehouse map
that other contexts read but never write. It does not own occupancy or
stock; that stays in `inventory-storage`'s `Bin`/`StockUnit` aggregates.

## Strategic Classification

| Dimension | Value |
|---|---|
| **Domain type** | **Generic Subdomain** |
| **Evolution (Wardley)** | Product / commodity — the location-code hierarchy is copied from the industry (WMS convention), not invented |
| **Model quality** | Not a differentiator — correctness matters enormously, cleverness does not |

**Justification.** DDD splits a domain into Core, Supporting and Generic
subdomains by *competitive differentiation*, not by criticality. Physical
location structure is well understood, has an established industry pattern
(Site → Area → Zone → Aisle → Bay → Level → Position), and is not where a
retailer or 3PL wins. It sits in the same bucket the platform's DDD reference
puts Cartonization and WCS in. The platform reference states the discipline
directly: *"Extract generic logic instead of duplicating it"* — physical
location is needed identically by contexts on both sides of the WMS/WES
line (`inventory-storage` for stow validity, `wes-work-planning` and
`fulfillment-execution` for travel-path and congestion reasoning), and
neither of them owns it. So it is extracted once, as its own bounded context
and its own service, rather than duplicated in either.

**Generic does not mean unimportant.** The map being wrong is catastrophic;
the map being clever is worthless. That shapes how the service is built:
correctness over cleverness, stability over feature velocity (four other
services are meant to conform to this context's Published Language), and
buy-shaped/build-because-we-must (the location-code hierarchy is an industry
standard, not an invention). This is why the context is **extract-once**:
one physical map, one author, everyone else a read-only Conformist.

## Domain Roles

| Role | Applies here? | Notes |
|---|---|---|
| **Business Rules / Policy** | Yes | `PlacementRule` evaluation (Deny-wins, Allow-list-if-any-Allow-exists, else unconstrained), enforced once at registration time. |
| **Book-keeper** | Partially | Registers and retires structural facts (Sites, Zones, Aisles, LocationSlots) but does not track any quantity or balance. |
| **Interchange / Gateway** | No | Never calls another warehouse-systems service. |
| **Analytics / Reporting** | Yes, additive | A separate analytical read side (`cmd/facility-reports`) built from this context's own events, on its own topic and database — the "Layout Catalog Growth & Change" report. |

This context is closest to a **Business Rules / Policy** engine over a small,
slow-changing structural catalogue, with a first-class rendering capability
(the two "draw the warehouse" read models) layered on top.

## Inbound Communication

| Sender | Communication style | How | Notes |
|---|---|---|---|
| `inventory-storage` | **Live, synchronous HTTP, rollback path** | `GET /locations/{locationCode}/classification` | The original scoped cross-backend call: `inventory-storage` called it at stow time to validate a Hazmat or TemperatureSensitive SKU against the slot's parent Zone's `hazmat`/`temperatureClass` attributes. Since inventory-storage ADR-0013 the **primary path is the event-fed cache** (see Outbound Communication); this endpoint is retained as the configured rollback (`LOCATION_LOOKUP_MODE=http`), not deleted. Note the direction: outbound from `inventory-storage`'s perspective, inbound to `facility-layout` — `facility-layout` is the callee, never the caller. |
| `facility-mfe` (this context's own browser client) | **Live, synchronous HTTP, browser-origin** | `GET /sites`, `GET /sites/{siteCode}/layout` over CORS | A Vite + React Module Federation remote owned in this repo's own `web/` directory, composed at runtime by the separate `warehouse-console` shell. It is a real, live, additive inbound HTTP surface — browser calling this service's own published REST API — not a bounded-context relationship in the Evans/Vernon sense (`warehouse-console` owns no domain model or aggregate). |
| `wes-work-planning` | **Live, synchronous HTTP** | `GET /distance?from=&to=` → `{metresM, estimated, route}` | Travel-distance input at `CommitShiftPlan`, via its `traveldistance` client (`TRAVEL_DISTANCE_MODE=http` + `FACILITY_LAYOUT_BASE_URL`; default `permissive`). Same-zone only; `estimated: true` when geometry is missing ([ADR 0017](https://github.com/claudioed/facility-layout/blob/develop/docs/docs/adr/0017-geometry-and-travel-graph.md)). |
| `fulfillment-execution` | **Opt-in, synchronous HTTP — not enabled in the kind cluster** | `GET /locations/{locationCode}` — the slot's `role` | Resolves a location's functional role at `RegisterStation`, via its `facilitylayout` client (`LOCATION_ROLE_MODE=http` + `FACILITY_LAYOUT_BASE_URL`; default `permissive`) ([ADR 0016](https://github.com/claudioed/facility-layout/blob/develop/docs/docs/adr/0016-functional-location-roles.md)). |
| `warehouse-ops-agent` | **Live, synchronous, read-only** | MCP tools `list_sites`, `get_site_layout`, `get_zone_grid`, `estimate_travel_distance`; REST `GET /reports/catalog-growth` (+ `/freshness`) on `cmd/facility-reports` | Read-side decision support; never writes. |
| Any REST client | **Live, synchronous HTTP** | The full `apis/openapi.yaml` surface — 31 operations across 23 paths: `/sites`, `/zones`, `/aisles`, `/location-types`, `/placement-rules`, `/locations`, `/locations/import`, plus the ADR 0016/0017 additions (`/sites/{siteCode}/locations?role=`, `/sites/{siteCode}/structures`, `/zones/{zoneId}/cross-aisles`, `/zones/{zoneId}/travel-graph`, the two geometry `PUT`s, `/distance`) | Usable today by anything that can make an HTTP call — operators, scripts, the getting-started curl walkthrough. Unauthenticated (ADR 0015). |
| MCP clients (Claude, agent frameworks) | **Live, synchronous, read-only** | Six tools over Streamable HTTP — `list_sites`, `get_site_layout`, `get_zone_grid`, `list_functional_locations`, `get_zone_travel_graph`, `estimate_travel_distance` — plus the curated `get_facility_catalog_growth_report` tool when the reports client is configured | A second driving adapter over the same read use cases the HTTP adapter calls. Every tool is annotated read-only; no write tool is registered — the map is written by operators, not agents. Unauthenticated (ADR 0015). |

## Outbound Communication

:::note[OHS status: one live event consumer; WES tier reads synchronously]
`facility-layout` publishes its whole Published Language — all twelve
domain events — to `warehouse.facility.events` via
`internal/adapters/outbound/kafka` (`EVENT_PUBLISHER=kafka`, ADR-0009),
documented in
[`apis/asyncapi.yaml`](https://github.com/claudioed/facility-layout/blob/develop/apis/asyncapi.yaml).
One event consumer is live today (`inventory-storage`). The WES-tier
contexts do not consume events; they call this context's REST API instead
(see Inbound Communication). This context itself calls no other service.
:::

| Receiver | Communication style | What it consumes | Status |
|---|---|---|---|
| `inventory-storage` (WMS · Core) | **Live** — event subscription, local read-model cache | `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | **Wired and verified.** inventory-storage's `internal/adapters/outbound/facilitycache/` replays the topic from the first offset on every start (per-instance-unique consumer group, readiness gated on catch-up) into a local location-classification cache used by `StowStock`'s Hazmat/TemperatureSensitive placement check (`LOCATION_LOOKUP_MODE=kafka`, its ADR-0013). Verified live with facility-layout at zero replicas: stows still classified correctly from the cache. The synchronous `GET /locations/{code}/classification` remains as the configured rollback (`LOCATION_LOOKUP_MODE=http`). |
| `wes-work-planning` (WES · Core) | Events not consumed — reads synchronously instead | `AisleRegistered`, `AisleGeometryUpdated`, `CrossAisleRegistered` would be the candidates for a local travel graph | Travel distance reaches it today through the live synchronous `GET /distance` call (Inbound Communication). Consuming the geometry events to keep a local travel graph is a design option, not code. |
| `fulfillment-execution` (Core) | Events not consumed — reads synchronously instead | — | Can read a slot's `role` through the opt-in synchronous `GET /locations/{locationCode}` call (Inbound Communication). No event consumer is built. |
| own analytics projector (`cmd/facility-projector`) | **Live** — separate topic `warehouse.facility.analytics` | The original eight events | This context's own read side for the catalog-growth report (ADR-0010) — not another bounded context. |
| `workforce-management` (Supporting) | **No planned relationship** | — | Stops at the process-path boundary and never links an associate to a specific location. |

The wired consumer is a downstream **Conformist**: it accepts this
context's model rather than negotiating a shared one, and translates it
into its own vocabulary at its edge (an anti-corruption cache keyed the
way *its* stow check needs). That is the right pattern precisely *because*
this is a Generic Subdomain — there is nothing to differentiate by
modelling location differently. `wes-work-planning` and
`fulfillment-execution` follow the same shape over REST, translating
`metresM` and `role` into their own models at their edge.

## Ubiquitous Language

See [Ubiquitous language](./ubiquitous-language.md) for the full glossary.
Core terms: **Site**, **Zone**, **Aisle**, **LocationType**,
**LocationSlot**, **PlacementRule**, **LocationCode**. This context
deliberately never uses `StockUnit`, `Reservation`, `Task`, `Assignment`,
`Wave`, `Pick`, `Pack`, `SLAM`, `Associate`, or `Shift` — any of those
appearing in the domain layer would mean the boundary had leaked.

## Business Decisions

- **PlacementRules are enforced once, at registration time, inside the
  domain** — not re-checked on every read and not left to a nightly
  reconciliation job. `RuleSet.Check` runs Deny-wins, then
  any-Allow-makes-an-allow-list, then unconstrained-if-neither. The
  rejection error always names the exact rule violated
  (`RULE-FRZ-NO-SHELF: Deny PalletRack where temperatureClass=Frozen`).
  Consequence: every Active slot in the database is legal by construction,
  and a downstream reader never needs to re-run the rule engine — but
  changing a rule does **not** retroactively invalidate existing slots
  (point-in-time enforcement, by design).
- **Chaotic-storage-adjacent placement, structurally.** This context does not
  itself implement chaotic (random) stow — that is `inventory-storage`'s
  domain — but it is the structural precondition for it: a chaotic-storage
  stow is only legal against a location this context says exists, is Active,
  and satisfies its PlacementRules. The adjacency is direct: `Zone`'s
  `TemperatureClass`/`Hazmat` and `PlacementRule`'s `(LocationType, Effect,
  ZonePredicate)` are exactly the facts a chaotic stow-time check needs, and
  the `GET /locations/{locationCode}/classification` endpoint exists
  specifically to let `inventory-storage` answer that cheaply rather than
  re-deriving it.
- **Location code validation is strict, not permissive.** Exactly seven
  hyphen-joined `[A-Z0-9]` segments; lowercase is rejected, never
  normalised, because the code is an identity and two spellings of one
  physical slot must not both be acceptable. Errors name the offending
  segment (`position segment "b"`) so a 500-row bulk import stays
  debuggable.
- **Registering a slot is a chain-of-custody check, not a bare insert.** The
  Site → Zone → Aisle chain the code implies must resolve to existing,
  `Active` aggregates, or the registration is rejected. No orphan slots,
  ever.
- **Decommission is one-way in v1.** No reactivation use case exists;
  re-registering a decommissioned `LocationCode` is rejected as a duplicate
  rather than quietly resurrecting the slot.
- **Bulk import is atomic per row, never all-or-nothing.** A row that fails
  is reported with its index, its location code, and the exact error; the
  other rows still commit.
- **RFC 7807 from the first commit**, deliberately skipping the bespoke
  error shape the sibling services had to migrate away from, because this
  context expects several consumers and a breaking error-contract change
  would be a breaking change for everyone at once.

## Assumptions

- Downstream consumers act as **Conformists** and translate this context's
  vocabulary into their own models rather than adopting
  `LocationSlot`/`Zone` as their own internal aggregates —
  `inventory-storage`'s location-classification cache is the live proof of
  the pattern.
- A `LocationCode`'s parent hierarchy will be read from the denormalized
  `zoneId`/`aisleId` fields already present on events and slot responses,
  never re-derived by a consumer splitting the code string.
- Re-slotting a building (which changes location codes) is rare, planned,
  and physically signposted — not a frequent operational event — which is
  why the cost of a hierarchical, meaning-carrying identity is accepted.
- The `EventPublisher` port's single-method shape
  (`Publish(ctx, event) error`) was deliberately the shape a Kafka producer
  would satisfy — an assumption that has since been proven: the broker
  adapter (ADR-0009) was added with no domain or application change.
- Reads vastly outnumber writes for this catalogue (a slot is registered
  once, read millions of times), which is the assumption underlying
  enforcing PlacementRules at registration time rather than on every read.

## Verification Metrics

| Metric | Target | Source |
|---|---|---|
| Combined statement coverage, `internal/domain/...` + `internal/application/...` | ≥ 90% | CI coverage gate, identical bar to the other four services |
| Architecture fitness test (`arch-go`) | Zero violations, blocking | `internal/architecture/architecture_test.go`, its own CI job |
| Failing-path test per invariant | 100% — every rejection branch in the chain-of-custody flow has a dedicated test | Domain + application unit tests, `godog`/Gherkin BDD suite over the real HTTP API |
| Report freshness SLA (analytical read side) | p95 event-to-report lag < 30s | `GET /reports/catalog-growth/freshness` |
| MCP tool surface size | ≤ 8 tools, PR-gated (7 today: six read tools plus the report tool) | MCP governance charter, Phase-6 CI lint (planned) |

## Open Questions

- Whether `wes-work-planning` should move from the synchronous
  `GET /distance` call to consuming `AisleRegistered`/`AisleGeometryUpdated`/
  `CrossAisleRegistered` into a local travel graph. Today the geometry
  events are on the topic and specced with no consumer.
- Cross-zone travel: `/distance` and `estimate_travel_distance` refuse two
  locations in different zones, because the travel graph does not yet
  connect zones ([ADR 0017](https://github.com/claudioed/facility-layout/blob/develop/docs/docs/adr/0017-geometry-and-travel-graph.md),
  status *Proposed* in the repository though the endpoints ship on
  `develop`).
- Whether a first-class "revalidate existing slots against current
  PlacementRules" use case is ever warranted, given that rule changes are
  not retroactive today and the only mitigation is a manual read-plus-audit
  against `GET /sites/{siteCode}/layout`.
- Whether `UnderMaintenance` ever gets a use case that *sets* it (today it
  is a legal persisted state the read models render, reachable only via
  external data loads, with no in-service transition into it).
- How trace propagation across the Kafka boundary will work — the
  integration publisher is deliberately trace-free by design (ADR-0009),
  and OTel propagation over the topic remains a known follow-up.
