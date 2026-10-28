---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: UML class diagrams of Product Discovery's read-side domain model, policies and projector, the search port, and the hexagonal ports-and-adapters layout, as the model designs them, with the as-built Go packages.
---

# Class Diagram

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

UML class diagrams of the `internal/domain/**` packages as the model designs them, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`productview.View`, `productview.Purchasable`,
`categoryview.View`, `ports.SearchPort` in the UL spellings). Fields are
unexported in Go and shown with `-`; methods are shown with `+`. There is
no aggregate and no `Err...` type in this context — nothing to refuse.

**As built** (`IQVO/product-discovery` develop `9c2f945`): the domain packages are `internal/domain/categoryview`, `internal/domain/productview`, `internal/domain/search`. Exported types per package: `categoryview`: `Category`, `Counted`, `View`; `productview`: `PublishedContent`, `Outcome`, `ItemCreated`, `ListingCreated`, `AvailabilityChanged`, `ListingSnapshot`, `PriceChanged`, `ItemState`, `ContentState`, `PriceState`, `ListingState`, `Attribute`, `Media`, `Listing`, `View`; `search`: `Band`, `Mode`, `Cursor`, `FacetValue`, `Facet`, `Counts`, `Sort`, `ValidationError`, `Input`, `Query`. Application packages: `internal/application/ports`, `internal/application/readmodel`, `internal/application/usecases`; adapters: `internal/adapters/inbound/http`, `internal/adapters/inbound/kafka`, `internal/adapters/inbound/requestlog`, `internal/adapters/outbound/kafka`, `internal/adapters/outbound/memory`, `internal/adapters/outbound/postgres`, `internal/adapters/outbound/repocontract`, `internal/adapters/outbound/sources`, `internal/adapters/outbound/telemetry`. Where a type name below differs (the UML keeps the design names), the [Ubiquitous Language](/storefront/contexts/product-discovery/ubiquitous-language) page carries the built identifier.

## 1. Read models (the domain package)

```mermaid
classDiagram
    direction TB
    class ProductView {
        <<ReadModel>>
        -catalogItemId string
        -title string
        -hazmat bool
        -fragile bool
        -itemActive bool
        -description string
        -attributes Attribute[]
        -media Media[]
        -bullets string[]
        -primaryCategoryId string
        -categoryPath string[]
        -listPrice Money
        -effectivePrice Money
        -priceActive bool
        -contentPublished bool
        -inStock bool
        -purchasable bool
        -contentRevisionApplied int64
        -priceVersionApplied int64
        +InStock() bool
        +Purchasable() bool
        +SearchDocument() SearchDocument
    }
    class CategoryView {
        <<ReadModel>>
        -treeVersion int64
        -categories CategoryNode[]
        +PurchasableCount(categoryId) int
    }
    class CategoryNode {
        <<ValueObject>>
        -categoryId string
        -parentId string nullable
        -name string
        -path string
    }
    class ListingRow {
        <<ValueObject>>
        -listingId string
        -nodeId string
        -state ListingState
        -availableQty int
        -asOf time
    }
    class ListingState {
        <<Enumeration>>
        LIVE
        SUPPRESSED
    }
    ProductView --> "0..*" ListingRow : joined by catalogItemId
    CategoryView *-- "0..*" CategoryNode : categories
    ListingRow --> ListingState : state
```

Derived from: `model.yaml → contexts[product-discovery].read_models`
(`ProductView`, `CategoryView`), `.policies`, `.ul`;
`apis/product-discovery/openapi.yaml` (`ProductView`, `CategoryView`).

Omitted: the `Money` and `Attribute`/`Media` value objects (same shape as
`product-content`'s, copied from its events), and the repository — the
store is a port (diagram 4), because a projection has no identity
lifecycle to guard. `ListingRow` is this pack's reading of what the fold
must keep for `ListingSuppressed`/`ListingRestored` (they carry only
`listingId`). `inStock` and `purchasable` are stored **and** derivable:
stored for the index, recomputed by `PurchasableRule` on every fold.

## 2. Policies, projector and the search port

```mermaid
classDiagram
    direction TB
    class PurchasableRule {
        <<Policy>>
        item ACTIVE and content PUBLISHED
        and price ACTIVE and one LIVE
        listing with quantity above 0
    }
    class UnavailableNotBuyable {
        <<Policy>>
        no LIVE listing with quantity
        above 0: shown as currently
        unavailable (gap S6)
    }
    class Projector {
        <<ApplicationService>>
        +Fold(ctx, event) Effect
        inbox on CloudEvents id
        guards: asOf, revision, version
    }
    class SearchPort {
        <<Port>>
        +Search(ctx, query) Result
        +Index(ctx, document)
    }
    class PostgresSearchAdapter {
        <<Adapter>>
        tsvector, GIN index,
        pg_trgm similarity fallback
    }
    Projector ..> PurchasableRule : applies
    Projector ..> UnavailableNotBuyable : paints
    Projector ..> SearchPort : indexes through
    SearchPort <|.. PostgresSearchAdapter : implements
```

Derived from: `model.yaml → contexts[product-discovery].policies`,
`.business_decisions` (2, 4 — the weights and the guards; D9 names the
port).

Omitted: the eleven consumed event structs — `offer-availability`'s and the
siblings' types, decoded in the consumer adapters. The `SearchPort` is the
model's own swap point: decision D9 exists so a dedicated engine later
replaces `PostgresSearchAdapter` and nothing else changes.

## 3. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>GET /products,<br/>GET /products/catalogItemId,<br/>GET /categories"]
        KC["kafka<br/>consumers: offer-availability,<br/>product-content, pricing"]
        OPS["ops<br/>rebuild job (no REST route)"]
    end
    APP["<b>internal/application/usecases</b><br/>SearchProducts<br/>GetProduct<br/>ListCategories<br/>FoldEvent (11 handlers)<br/>RebuildProjections"]
    DOM["<b>internal/domain</b><br/>productview.View<br/>categoryview.View<br/>PurchasableRule, UnavailableNotBuyable"]
    PORTS["<b>internal/application/ports</b><br/>ProductViewStore<br/>CategoryViewStore<br/>SearchPort<br/>Inbox<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>projections + search index,<br/>inbox, UoW"]
        A2["search<br/>PostgresSearchAdapter<br/>(tsvector + pg_trgm, D9)"]
    end
    HTTP --> APP
    KC --> APP
    OPS --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    PORTS --- A2
```

Derived from: `model.yaml → contexts[product-discovery].inbound`, `.rest`,
`.consumes`, `.read_models`; `conventions.integration_rules` (inbox,
dispatch on the full type); the fleet's Go hexagonal layout.

Omitted: the composition root (`cmd/product-discovery`), metrics and
tracing, and the bootstrap snapshot HTTP clients — four thin outbound
clients used only by `RebuildProjections` on the ops path (see
[Use Cases](/storefront/contexts/product-discovery/use-cases)). There is
**no outbox relay and no producer**: `publishes: []`, so the only Kafka
adapters are the three inbound consumers. The domain package imports
nothing from application or adapters (fleet rule 5).
