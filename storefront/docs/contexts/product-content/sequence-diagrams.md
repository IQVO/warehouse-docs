---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Product Content command use case, from inbound adapter through aggregate, repository and outbox to Kafka, with error, concurrency and idempotency branches.
---

# Sequence Diagrams

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model carries the proposed contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

One UML sequence diagram per command use case on
[Use Cases](/storefront/contexts/product-content/use-cases). Participant names are the
proposed packages and ports from the
[Class Diagram](/storefront/contexts/product-content/class-diagram):

- `http` and `kafka` are the inbound adapters.
- The use case is in `internal/application/usecases`.
- `Postgres` stands for the repositories, the catalog item store, the
  outbox, the inbox and the idempotency store. They share one transaction
  through `UnitOfWork`.
- `Relay / Kafka` is the outbox relay. It reads committed `outbox_events`
  rows and publishes them to `retailnetwork.product-content.events`.

Every save is conditional on the loaded `version` (optimistic concurrency).
Full CloudEvents types are on [Domain Events](/storefront/contexts/product-content/domain-events).

## 1. CreateProductContent (REST POST /product-contents)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as CreateProductContent
    participant V as CatalogItemView
    participant A as ProductContent
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen with the same body
        DB-->>H: stored response, replay 201
    else new key
        H->>UC: Execute(catalogItemId, input)
        UC->>V: Known(catalogItemId)
        alt unknown item
            V-->>UC: false
            UC-->>H: 422 unknown-catalog-item<br/>ErrUnknownCatalogItem
        else item known
            UC->>A: CreateProductContent(catalogItemId, input, categoryKnown, itemDiscontinued)
            alt ErrItemDiscontinued
                A-->>UC: error
                UC-->>H: 422 item-discontinued
            else ErrTooManyBullets, ErrTooManyAttributes or ErrTooManyMedia
                A-->>UC: error
                UC-->>H: 422 too-many-bullets, too-many-attributes or too-many-media
            else ErrUnknownCategory
                A-->>UC: error
                UC-->>H: 422 unknown-category
            else valid
                A-->>UC: content DRAFT
                UC->>DB: BEGIN, insert content version 1
                alt duplicate for the item
                    DB-->>UC: conflict, ROLLBACK
                    UC-->>H: 409 concurrent-update
                else inserted
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 201 DRAFT
                end
            end
        end
    end
    Note over UC,DB: no event, no outbox row
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`CreateProductContent`, `ErrUnknownCatalogItem`, `ErrItemDiscontinued`,
`ErrTooManyBullets`, `ErrTooManyAttributes`, `ErrTooManyMedia`,
`ErrUnknownCategory`),
`.read_models`; `apis/product-content/openapi.yaml`.

Omitted: the schema validation (422 validation-failed), which happens in the
adapter before the use case. A lagging
`CatalogItemView` rejects content for a brand-new item: the manager retries
after the projection catches up.

## 2. ReviseContent (REST POST /product-contents/catalogItemId:revise)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as ReviseContent
    participant A as ProductContent
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(catalogItemId, input)
        UC->>DB: load content and version
        alt not found
            UC-->>H: 404 not-found
        else found
            UC->>A: ReviseContent(input)
            alt ErrContentRetired
                A-->>UC: error
                UC-->>H: 409 content-retired
            else ErrUnknownCategory or ErrTooMany...
                A-->>UC: error
                UC-->>H: 422 unknown-category or too-many-...
            else valid
                A-->>UC: still PUBLISHED, content replaced
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK
                    UC->>UC: reload and retry once, then 409 concurrent-update
                else saved
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 revised content
                end
            end
        end
    end
    Note over UC,DB: no event, no outbox row,<br/>the revised content leaves on the next PublishContent
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`ReviseContent`, `ErrContentRetired`, `ErrUnknownCategory`, transitions).

Omitted: the DRAFT case, which is `ReviseDraft` (diagram 10). The revision
reaches `product-discovery` through the next `PublishContent`
(`PUBLISHED → PUBLISHED`, diagram 3).

## 3. PublishContent (REST POST /product-contents/catalogItemId:publish)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as PublishContent
    participant A as ProductContent
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(catalogItemId)
        UC->>DB: load content and version
        alt not found
            UC-->>H: 404 not-found
        else found
            UC->>A: PublishContent(itemDiscontinued)
            alt ErrItemDiscontinued
                A-->>UC: error
                UC-->>H: 422 item-discontinued
            else ErrIncompleteContent
                A-->>UC: error
                UC-->>H: 422 incomplete-content
            else ErrUnknownCategory
                A-->>UC: error
                UC-->>H: 422 unknown-category
            else ErrContentRetired
                A-->>UC: error
                UC-->>H: 409 content-retired
            else gate passes
                A-->>UC: PUBLISHED (from DRAFT or PUBLISHED),<br/>revision bumped + ProductContentPublished
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
                else saved
                    UC->>DB: insert outbox ProductContentPublished
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 PUBLISHED
                    K->>DB: poll unpublished outbox rows
                    K->>K: publish key catalogItemId
                    K->>DB: mark published_at
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`PublishContent`, `ErrItemDiscontinued`, invariants, transitions
`DRAFT → PUBLISHED` and `PUBLISHED → PUBLISHED`),
`.publishes[ProductContentPublished]`;
`conventions.integration_rules`.

Omitted: nothing beyond the shared notes at the top.

## 4. RetireContent by the content manager (REST POST .../catalogItemId:retire)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as RetireContent
    participant A as ProductContent
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(catalogItemId)
        UC->>DB: load content and version
        alt not found
            UC-->>H: 404 not-found
        else found
            UC->>A: RetireContent()
            alt not PUBLISHED
                A-->>UC: illegal transition
                UC-->>H: 409 illegal-transition
            else allowed
                A-->>UC: RETIRED + ProductContentRetired
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
                else saved
                    UC->>DB: insert outbox ProductContentRetired
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 RETIRED
                    K->>DB: poll outbox
                    K->>K: publish key catalogItemId
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`RetireContent`, transitions), `.publishes[ProductContentRetired]`.

Omitted: the relay marking the row published (as in diagram 3). A DRAFT
is not retired by hand: it is discarded with `DiscardDraft` (diagram 10).

## 5. RetireContent by policy (Kafka CatalogItemDiscontinued)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as RetireOnDiscontinue
    participant A as ProductContent
    participant DB as Postgres
    participant K as Relay / Kafka
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new CatalogItemDiscontinued
        KC->>UC: Execute(catalogItemId)
        UC->>DB: BEGIN, mark discontinued in rm_catalog_items,<br/>insert inbox row, COMMIT
        UC->>DB: load content and version
        alt no content, or already RETIRED
            UC->>UC: nothing to retire
        else DRAFT
            UC->>A: RetireContent(DISCONTINUED)
            A-->>UC: RETIRED, no event
            UC->>DB: update where version matches, COMMIT
        else PUBLISHED
            UC->>A: RetireContent()
            A-->>UC: RETIRED + ProductContentRetired
            UC->>DB: BEGIN, update where version matches
            alt version changed
                DB-->>UC: 0 rows, ROLLBACK, redeliver
            else saved
                UC->>DB: insert outbox ProductContentRetired, COMMIT
                K->>DB: poll outbox
                K->>K: publish key catalogItemId
            end
        end
    end
```

Derived from: `model.yaml → contexts[product-content].policies[RetireOnDiscontinue]`,
`.consumes` (`CatalogItemDiscontinued`), `.publishes[ProductContentRetired]`.

Omitted: the `CatalogItemCreated` projection (same shape, no policy branch,
no outbox row). The view update commits before the content load so a crash
in between is healed by the replay.

## 6. CreateCategory (REST POST /categories)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as CreateCategory
    participant T as CategoryTree
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay 201
    else new key
        H->>UC: Execute(parentId, name)
        UC->>DB: load tree and version
        UC->>T: CreateCategory(parentId, name)
        alt ErrMaxDepth
            T-->>UC: error
            UC-->>H: 422 max-depth
        else ErrCategoryCycle
            T-->>UC: error
            UC-->>H: 422 category-cycle
        else ErrDuplicateSiblingName
            T-->>UC: error
            UC-->>H: 422 duplicate-sibling-name
        else valid
            T-->>UC: category created, path computed
            UC->>DB: BEGIN, update where version matches
            alt version changed
                DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
            else saved
                UC->>DB: insert outbox CategoryTreePublished<br/>store key response, COMMIT
                UC-->>H: 201 category
            end
        end
    end
    Note over UC,DB: applies to the live tree and<br/>publishes CategoryTreePublished
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree]`
(`CreateCategory`, invariants); `apis/product-content/openapi.yaml`.

Omitted: the 404 for an unknown `parentId` (the proposed API lists no
not-found on create; a missing parent fails validation).

## 7. MoveCategory (REST POST /categories/categoryId:move)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as MoveCategory
    participant T as CategoryTree
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(categoryId, parentId)
        UC->>DB: load tree and version
        alt category unknown
            UC-->>H: 404 not-found
        else found
            UC->>T: MoveCategory(categoryId, parentId)
            alt ErrCategoryCycle
                T-->>UC: error, new parent inside the subtree
                UC-->>H: 422 category-cycle
            else ErrMaxDepth or ErrDuplicateSiblingName
                T-->>UC: error
                UC-->>H: 422 max-depth or duplicate-sibling-name
            else valid
                T-->>UC: subtree moved, paths recomputed
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
                else saved
                    UC->>DB: insert outbox CategoryTreePublished<br/>store key response, COMMIT
                    UC-->>H: 200 category
                end
            end
        end
    end
    Note over UC,DB: applies to the live tree and<br/>publishes CategoryTreePublished
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree]`
(`MoveCategory`, invariants); `apis/product-content/openapi.yaml`.
`ErrCategoryInUse` is not raised: there is no remove-category command by
design, and the guard is for a future removal.

Omitted: nothing beyond the shared notes.

## 8. RenameCategory (REST POST /categories/categoryId:rename)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as RenameCategory
    participant T as CategoryTree
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(categoryId, name)
        UC->>DB: load tree and version
        alt category unknown
            UC-->>H: 404 not-found
        else found
            UC->>T: RenameCategory(categoryId, name)
            alt ErrDuplicateSiblingName
                T-->>UC: error
                UC-->>H: 422 duplicate-sibling-name
            else valid
                T-->>UC: renamed, path recomputed
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
                else saved
                    UC->>DB: insert outbox CategoryTreePublished<br/>store key response, COMMIT
                    UC-->>H: 200 category
                end
            end
        end
    end
    Note over UC,DB: applies to the live tree and<br/>publishes CategoryTreePublished
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree]`
(`RenameCategory`, `ErrDuplicateSiblingName`).

Omitted: nothing beyond the shared notes.

## 9. PublishCategoryTree (REST POST /categories:publish)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as PublishCategoryTree
    participant T as CategoryTree
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    H->>UC: Execute()
    UC->>DB: load tree and version
    UC->>T: PublishCategoryTree()
    T-->>UC: still PUBLISHED, tree version bumped<br/>+ CategoryTreePublished
    UC->>DB: BEGIN, update where version matches
    alt version changed
        DB-->>UC: 0 rows, ROLLBACK, retry once, then 409
    else saved
        UC->>DB: insert outbox CategoryTreePublished<br/>store key response, COMMIT
        UC-->>H: 200 published tree
        K->>DB: poll unpublished outbox rows
        K->>K: publish key categoryTreeId
        K->>DB: mark published_at
    end
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree]`
(`PublishCategoryTree`, transitions), `.publishes[CategoryTreePublished]`.

Omitted: nothing beyond the shared notes. `PublishCategoryTree` re-publishes
the live tree unchanged so consumers can resync; the structural invariants need
no re-check at publication: they hold for the live tree at all times.

## 10. ReviseDraft and DiscardDraft (REST POST .../catalogItemId:revise-draft, :discard)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as ReviseDraft / DiscardDraft
    participant A as ProductContent
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    H->>UC: Execute(catalogItemId, input?)
    UC->>DB: load content and version
    alt not found
        UC-->>H: 404 not-found
    else found
        UC->>A: ReviseDraft(input) or DiscardDraft()
        alt not DRAFT
            A-->>UC: illegal transition
            UC-->>H: 409 illegal-transition
        else ErrTooMany... or ErrUnknownCategory (revise only)
            A-->>UC: error
            UC-->>H: 422 too-many-... or unknown-category
        else DRAFT to DRAFT, or DRAFT to RETIRED (DISCARDED)
            UC->>DB: BEGIN, update where version matches<br/>store key response, COMMIT
            UC-->>H: 200 content
        end
    end
    Note over UC,DB: no event, no outbox row:<br/>nothing was ever published
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent]`
(`ReviseDraft`, `DiscardDraft`, transitions `DRAFT → DRAFT` and
`DRAFT → RETIRED`); `apis/product-content/openapi.yaml`.

Omitted: the optimistic-concurrency retry, as in diagram 2.
