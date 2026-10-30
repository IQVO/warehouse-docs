---
id: aggregate-design-canvas
title: Aggregate Design Canvas
sidebar_label: Aggregate Design Canvas
description: "The ddd-crew Aggregate Design Canvas applied to Product Discovery's two read models, ProductView and CategoryView — the context has no aggregate by decision (its ADR 0002): projections only."
---

# Aggregate Design Canvas

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

Following the ddd-crew [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas).
**This context has no aggregate** — `aggregates: []`, business decision 1:
"No aggregate in v1 (its ADR 0002 says so plainly): projections only." So
this page applies the canvas to the two **read models** the model does
name, **ProductView** and **CategoryView**, and answers each canvas section
honestly: most sections exist to protect invariants, and a projection
protects none. Go packages **as built**: `internal/domain/categoryview`, `internal/domain/productview`, `internal/domain/search` (plus `shared`).

## Why no aggregate (the canvas question zero)

An aggregate exists to enforce invariants across a transactional boundary:
it takes commands, refuses illegal states with an `Err...`, and publishes
facts. Everything here is the opposite:

| Aggregate property | Product Discovery |
| --- | --- |
| Takes commands | No — `inbound` has one query row and three event rows; `rest` is three `GET`s. |
| Enforces invariants (`Err...`) | No — the model names not one `Err` for this context; nothing is refused, facts are folded. |
| Owns a state machine | No — `inStock` and `purchasable` are **derived** values, recomputed from stored upstream facts (`PurchasableRule`), not states with transitions. |
| Publishes events | No — `publishes: []`; no outbox, no topic, no consumer to break. |
| Can be wrong and corrected by hand | Never — a wrong projection is **rebuilt** from its sources (business decision 5), not edited. |

The guards (listing `asOf`, content `revision`, price `version`) are
ordering rules on the fold, not invariants: they never reject a fact as
illegal, they only skip a stale redelivery.

## ProductView

### 1. Name

`ProductView` (`productview.View`), one row per `catalogItemId`.

### 2. Description

The projection one product page or search hit renders from: title, flags,
content, category path, list and effective price, `inStock`, `purchasable`
— the join of three upstream feeds. Stored alongside it (this pack's
reading of what the fold needs): the listing rows behind `inStock` and the
per-source guard values (`asOf`, `revision`, `version`).

### 3. State Transitions

None. There is no state machine; the closest things to states are derived
booleans, each recomputed on every fold:

| Derived value | Recomputed by | From |
| --- | --- | --- |
| `inStock` | every `listing.*` fold | at least one LIVE listing with quantity above 0 |
| `purchasable` | every fold, via `PurchasableRule` | item ACTIVE, content PUBLISHED, price ACTIVE, `inStock` |

### 4. Enforced Invariants

None — by decision. `PurchasableRule` looks like one but derives display
truth; it rejects nothing (see
[Ubiquitous Language](/storefront/contexts/product-discovery/ubiquitous-language),
"Purchasable Rule"). The **correctness rules that do exist** are
consumption rules, from `conventions.integration_rules` and business
decision 4:

| Rule | Kind | Effect |
| --- | --- | --- |
| Inbox on the CloudEvents `id` | idempotency | a redelivery is acknowledged without effect |
| Per-source monotonic guards (`asOf`, `revision`, `version`) | ordering | an older fact never overwrites a newer one |
| Dispatch on the full type string | routing | eleven distinct handlers, never a suffix match |

### 5. Corrective Policies

| Policy | Owner | Rule | Effect on this read model |
| --- | --- | --- | --- |
| Rebuild | this context (ops) | snapshot + catch-up (business decision 5) | the whole projection is disposable: paged reads of the four sources, then events from recorded offsets; guards make the overlap safe |
| `PurchasableRule` | this context | the four-input verdict | recomputes `purchasable` on every fold — a repair of the derived value, not of the facts |
| `UnavailableNotBuyable` | this context | no LIVE listing with quantity above 0 means shown as currently unavailable | the row stays visible, unbuyable (gap S6) |

### 6. Handled Commands

None. The queries `SearchProducts`, `GetProduct` and `ListCategories` read
the row; the eleven consumed events feed it. Neither is a command: queries
change nothing, and a consumed event is a fact to fold, not an instruction
to accept or reject.

### 7. Created Events

None (`publishes: []`). Nothing downstream depends on this projection
changing — the CQRS shape that keeps the cart, checkout and payments
re-deriving from the same feeds instead of listening to this context.

### 8. Throughput

*Estimate, not in the model.* High on reads (every search, every product
page) and on the availability feed: `ListingAvailabilityChanged` is the
network's hottest event this side of ordering, one fold per listing per
change. The other two feeds are merchandising-paced. The search index write
rides along only when an indexed column actually changes.

### 9. Size

*Estimate, not in the model.* One row per catalogue item plus one row per
listing — the sibling `pricing` context estimates `~10^6` ACTIVE items, and
listings outnumber items (one per item per node). All rows are rebuildable
from the topics or, past retention, from the snapshot reads.

## CategoryView

### 1. Name

`CategoryView` (`categoryview.View`), one tree under one
`version`.

### 2. Description

The browsable tree with purchasable counts per category: the whole tree
arrives per `CategoryTreePublished` (`version`, `categories`), and the
counts are **derived from `ProductView`**, not carried by the event.

### 3. State Transitions

None. The tree is replaced wholesale when a newer `version` arrives (the
`version` guard); between publications nothing changes here.

### 4. Enforced Invariants

None. The tree's own structural invariants (no cycle, depth at most four,
unique sibling names) live in `product-content`'s `CategoryTree`
aggregate — this context receives an already-valid tree
([its canvas](/storefront/contexts/product-content/aggregate-design-canvas)).

### 5. Corrective Policies

Rebuild, as above: the tree is re-read from `product-content`'s
`GET /categories` bootstrap read, the counts recomputed from the
`ProductView` snapshot.

### 6. Handled Commands

None. `ListCategories` (`GET /categories`) reads it.

### 7. Created Events

None.

### 8. Throughput

*Estimate, not in the model.* Rare writes (a tree publication; count
updates ride every relevant fold). Reads are browse-paced.

### 9. Size

*Estimate, not in the model.* The `CategoryTree` aggregate it projects is
"one tree, ~10^3 categories" (`product-content`'s `size_estimate`); the
view adds one integer per category.

## Read models

| Read model | Source events | Serves | Why it is not an aggregate |
| --- | --- | --- | --- |
| `ProductView` | `offer-availability` `CatalogItemCreated`, `CatalogItemDiscontinued`, `ListingCreated`, `ListingAvailabilityChanged`, `ListingSuppressed`, `ListingRestored`; `product-content` `ProductContentPublished`, `ProductContentRetired`; `pricing` `ItemPriceChanged`, `ItemPriceWithdrawn` (per-source guards on top) | `SearchProducts`, `GetProduct`, the `purchasable` verdict, the `CategoryView` counts | It protects no invariant and takes no command; it is a join of facts three upstreams own, and it can be dropped and rebuilt at any time. `CategoryTreePublished` is deliberately absent from its source list — the gap that a category rename never re-indexes the rows (hotspot H3 on [EventStorming](/storefront/contexts/product-discovery/eventstorming)). |
| `CategoryView` | `product-content` `CategoryTreePublished` plus purchasable counts derived from `ProductView` | `ListCategories` | Same: a projection of `product-content`'s aggregate plus a count query. |

Derived from: `model.yaml → contexts[product-discovery].read_models`,
`.policies`, `.rest`, `.consumes`; `contexts[product-content].aggregates[CategoryTree]`.
