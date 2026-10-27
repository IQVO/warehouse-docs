---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Product Content's domain model, events and policy, and the hexagonal ports-and-adapters layout a Go implementation would use.
---

# Class Diagram

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-content` service is built on develop ([`IQVO/product-content`](https://github.com/IQVO/product-content) at `2f09dc0`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-content#service-and-operations) section lists it.
:::

UML class diagrams of the **proposed** `internal/domain/**` packages, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`content.ProductContent`, `content.Media.RolePrimary`,
`category.Tree`, `category.Category`) and value objects. Fields are
unexported in Go and shown with `-`; methods are shown with `+`.

## 1. ProductContent aggregate

```mermaid
classDiagram
    direction TB
    class ProductContent {
        <<AggregateRoot>>
        -catalogItemId string
        -status ContentStatus
        -retiredReason RetiredReason nullable
        -description string
        -bullets string[]
        -attributes Attribute[]
        -media Media[]
        -primaryCategoryId string
        -revision int64
        -version int
        +CreateProductContent(catalogItemId, input, itemKnown, categoryKnown, itemDiscontinued)$ ProductContent
        +ReviseDraft(input) error
        +ReviseContent(input) error
        +PublishContent(itemDiscontinued) error
        +DiscardDraft() error
        +RetireContent(reason) error
    }
    class ContentStatus {
        <<Enumeration>>
        DRAFT
        PUBLISHED
        RETIRED
    }
    class RetiredReason {
        <<Enumeration>>
        DISCARDED
        DISCONTINUED
        RETIRED_BY_HAND
    }
    class Attribute {
        <<ValueObject>>
        -name string
        -value string
        -unit string nullable
    }
    class Media {
        <<ValueObject>>
        -mediaId string
        -url string
        -altText string
        -role MediaRole
    }
    class MediaRole {
        <<Enumeration>>
        PRIMARY
        GALLERY
    }
    class ProductContentRepository {
        <<Repository>>
        +Get(ctx, catalogItemId) ProductContent
        +Insert(ctx, c) error
        +Update(ctx, c, expectedVersion) error
    }
    ProductContent --> ContentStatus : status
    ProductContent --> RetiredReason : retiredReason
    ProductContent *-- "0..50" Attribute : attributes
    ProductContent *-- "0..12" Media : media
    Media --> MediaRole : role
    ProductContentRepository ..> ProductContent : persists
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`states`, `value_objects`, `commands`, `invariants`, `description`).

Omitted: read accessors, the `Err...` variables (`ErrUnknownCatalogItem`,
`ErrItemDiscontinued`, `ErrIncompleteContent`, `ErrUnknownCategory`, `ErrContentRetired`,
`ErrTooManyBullets`, `ErrTooManyAttributes`, `ErrTooManyMedia`; listed on
the [Aggregate Design Canvas](/storefront/contexts/product-content/aggregate-design-canvas)),
and the publication timestamps the REST read returns. `itemKnown` and
`categoryKnown` stand for the existence checks against `CatalogItemView` and
the `CategoryTree`, and `itemDiscontinued` for the discontinued flag read from
`CatalogItemView`; the aggregate decides, the use case supplies the facts.
The collection bounds (0..10 bullets, 0..50 attributes, 0..12 media) come
from the aggregate description and the proposed API schema; they are the
named invariants `ErrTooManyBullets`, `ErrTooManyAttributes` and
`ErrTooManyMedia`. `RetireContent(reason)` is also what `RetireOnDiscontinue`
runs, with reason `DISCONTINUED`.

## 2. CategoryTree aggregate

```mermaid
classDiagram
    direction TB
    class CategoryTree {
        <<AggregateRoot>>
        -categoryTreeId string
        -treeVersion int64
        -categories Category[]
        -version int
        +CreateCategory(parentId, name) Category
        +MoveCategory(categoryId, parentId) error
        +RenameCategory(categoryId, name) error
        +PublishCategoryTree() error
    }
    class Category {
        <<ValueObject>>
        -categoryId string
        -parentId string nullable
        -name string
        -path string
    }
    class CategoryTreeRepository {
        <<Repository>>
        +Get(ctx) CategoryTree
        +Update(ctx, t, expectedVersion) error
    }
    CategoryTree *-- "0..*" Category : categories
    CategoryTreeRepository ..> CategoryTree : persists
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree]`
(`states`, `value_objects`, `commands`, `invariants`, `notes`).

Omitted: the `Err...` variables (`ErrCategoryCycle`, `ErrMaxDepth`,
`ErrDuplicateSiblingName`, `ErrCategoryInUse`, which guards a future removal:
no remove-category command exists by design). `treeVersion` is the
published version the event carries; `version` is the
optimistic-concurrency guard of the save. The tree is single
(`size_estimate`: "one tree"), so the repository `Get` takes no id; the
`categoryTreeId` still keys the Kafka messages. The tree has no status: it
is a single published aggregate and every command applies to the live tree
and publishes a new version.

## 3. Domain events and policy

```mermaid
classDiagram
    direction TB
    class ProductContentPublished {
        <<DomainEvent>>
        +catalogItemId string
        +revision int64
        +description string
        +bullets string[]
        +attributes Attribute[]
        +media Media[]
        +primaryCategoryId string
    }
    class ProductContentRetired {
        <<DomainEvent>>
        +catalogItemId string
        +revision int64
    }
    class CategoryTreePublished {
        <<DomainEvent>>
        +version int64
        +categories Category[]
    }
```

```mermaid
classDiagram
    direction TB
    class RetireOnDiscontinue {
        <<Policy>>
        on CatalogItemDiscontinued
        retire the item's PUBLISHED and DRAFT content
    }
    class CatalogItemView {
        <<ReadModel>>
        +Known(catalogItemId) bool
        +Discontinued(catalogItemId) bool
    }
    class RetireContent {
        <<Command>>
    }
    RetireOnDiscontinue ..> CatalogItemView : reads
    RetireOnDiscontinue ..> RetireContent : runs
```

Derived from: `model.yaml → contexts[product-content].publishes`,
`.policies`, `.read_models`.

Omitted: the CloudEvents envelope (built in the Kafka adapter), and the
consumed events (`CatalogItemCreated`, `CatalogItemDiscontinued`), which are
`offer-availability`'s types, decoded in the consumer adapter. The events
carry no title, price, stock or PII.

## 4. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>content manager routes,<br/>bootstrap reads"]
        KC["kafka<br/>consumer: offer-availability"]
    end
    APP["<b>internal/application/usecases</b><br/>CreateProductContent<br/>ReviseDraft, ReviseContent<br/>PublishContent, DiscardDraft<br/>RetireContent (REST and policy)<br/>CreateCategory, MoveCategory,<br/>RenameCategory<br/>PublishCategoryTree<br/>ProjectCatalogItems"]
    DOM["<b>internal/domain</b><br/>content.ProductContent<br/>category.Tree"]
    PORTS["<b>internal/application/ports</b><br/>ProductContentRepository<br/>CategoryTreeRepository<br/>CatalogItemStore<br/>Outbox, Inbox<br/>IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repositories, outbox, inbox,<br/>catalog item store,<br/>idempotency store, UoW"]
        A2["kafka<br/>outbox relay"]
    end
    HTTP --> APP
    KC --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    A1 -. outbox rows .-> A2
```

Derived from: `model.yaml → contexts[product-content].aggregates`,
`.inbound`, `.read_models`; `conventions.integration_rules` (outbox, inbox);
the fleet's Go hexagonal layout.

Omitted: the composition root (`cmd/product-content`), metrics and tracing.
`ProjectCatalogItems` is the projector that writes `CatalogItemView`; it is
not a command of the model and changes no aggregate (its sibling effect,
retirement, is the `RetireOnDiscontinue` policy). There is **no outbound
REST client adapter**: `sync_calls` is empty. The read routes
(`ListProductContents`, `GetProductContent`, `ListCategories`) read the
stores through their ports without a use case.
