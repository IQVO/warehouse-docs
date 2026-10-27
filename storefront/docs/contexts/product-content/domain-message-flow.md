---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Five Product Content scenarios as ddd-crew domain message flows, covering authoring to publish, a rejected publish, category tree publication, retirement on discontinue, and the bootstrap reads.
---

# Domain Message Flow

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-content` service is built on develop ([`IQVO/product-content`](https://github.com/IQVO/product-content) at `2f09dc0`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-content#service-and-operations) section lists it.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Five scenarios. Participants are contexts and actors. Every arrow is a
message from the model, prefixed `cmd:` (command), `qry:` (query) or `evt:`
(event). A `Note` names a command a context runs on itself. Kafka is drawn
as one participant. Event names are written `entity.EventName`; the full
type is `com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/storefront/contexts/product-content/domain-events)). REST path
parameters are written without braces. The storefront-wide relationships are on
the [Context Map](/storefront/strategic-design/context-map).

## 1. Author and publish content

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor CM as Content manager
    participant PC as product-content
    participant K as Kafka
    participant PD as product-discovery
    CM->>PC: cmd: CreateProductContent<br/>POST /product-contents
    Note over PC: check CatalogItemView,<br/>state DRAFT
    PC-->>CM: cmd: reply 201 DRAFT
    CM->>PC: cmd: PublishContent<br/>POST /product-contents/catalogItemId:publish
    Note over PC: publish gate, state PUBLISHED,<br/>revision bumped
    PC->>K: evt: productcontent.<br/>ProductContentPublished
    PC-->>CM: cmd: reply 200 PUBLISHED
    K->>PD: evt: productcontent.<br/>ProductContentPublished
    Note over PD: fold into ProductView,<br/>revision guard
```

Derived from: `model.yaml → contexts[product-content].inbound`,
`.aggregates[ProductContent].transitions`, `.invariants`, `.publishes`;
`contexts[product-discovery].consumes`.

Omitted: the outbox write and relay (the event leaves after the commit; see
[Sequence Diagrams](/storefront/contexts/product-content/sequence-diagrams)); the
`Idempotency-Key` handling; how the item reached `CatalogItemView`
(scenario 4's topic, `CatalogItemCreated`).

## 2. Publish rejected: incomplete content (failure path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor CM as Content manager
    participant PC as product-content
    CM->>PC: cmd: PublishContent<br/>POST :publish
    alt no description, or not exactly one PRIMARY medium, or no category
        PC-->>CM: cmd: reply 422<br/>incomplete-content
    else primary category not in the current tree
        PC-->>CM: cmd: reply 422<br/>unknown-category
    else content RETIRED
        PC-->>CM: cmd: reply 409<br/>content-retired
    end
    Note over PC: nothing saved,<br/>nothing published
```

Derived from: `model.yaml → contexts[product-content].aggregates[ProductContent].invariants`
(`ErrIncompleteContent`, `ErrUnknownCategory`, `ErrContentRetired`);
`apis/product-content/openapi.yaml` (`:publish` responses).

Omitted: the correction loop (the manager edits and publishes again; with
the model as written, a DRAFT is corrected by creating the full content —
hotspot H1 on [EventStorming](/storefront/contexts/product-content/eventstorming)).

## 3. Edit the tree and publish it

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor CM as Content manager
    participant PC as product-content
    participant K as Kafka
    participant PD as product-discovery
    CM->>PC: cmd: CreateCategory<br/>POST /categories
    PC-->>CM: cmd: reply 201 category
    CM->>PC: cmd: MoveCategory<br/>POST /categories/categoryId:move
    PC-->>CM: cmd: reply 200 category
    CM->>PC: cmd: RenameCategory<br/>POST /categories/categoryId:rename
    PC-->>CM: cmd: reply 200 category
    CM->>PC: cmd: PublishCategoryTree<br/>trigger not modelled
    Note over PC: state PUBLISHED,<br/>tree version bumped
    PC->>K: evt: categorytree.<br/>CategoryTreePublished
    K->>PD: evt: categorytree.<br/>CategoryTreePublished
    Note over PD: replace CategoryView,<br/>version guard
```

Derived from: `model.yaml → contexts[product-content].aggregates[CategoryTree].commands`,
`.transitions`, `.publishes[CategoryTreePublished]`;
`contexts[product-discovery].consumes`.

Omitted: the structural errors (`ErrCategoryCycle`, `ErrMaxDepth`,
`ErrDuplicateSiblingName`) each edit can fail with. The edits raise no
event: the tree crosses the boundary only at publication. The
`PublishCategoryTree` arrow has no route because the model names no inbound
row for it (hotspot H6).

## 4. Item discontinued: retire the content

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OA as offer-availability
    participant K as Kafka
    participant PC as product-content
    participant PD as product-discovery
    OA->>K: evt: catalogitem.<br/>CatalogItemCreated
    K->>PC: evt: catalogitem.<br/>CatalogItemCreated
    Note over PC: project into CatalogItemView
    OA->>K: evt: catalogitem.<br/>CatalogItemDiscontinued
    K->>PC: evt: catalogitem.<br/>CatalogItemDiscontinued
    Note over PC: mark discontinued,<br/>policy RetireOnDiscontinue
    alt content is PUBLISHED
        Note over PC: RetireContent,<br/>state RETIRED
        PC->>K: evt: productcontent.<br/>ProductContentRetired
        K->>PD: evt: productcontent.<br/>ProductContentRetired
        Note over PD: content not PUBLISHED,<br/>not purchasable
    else content is DRAFT or absent
        Note over PC: nothing happens<br/>(model silent, hotspot H7)
    end
```

Derived from: `model.yaml → contexts[product-content].consumes`,
`.read_models[CatalogItemView]`, `.policies[RetireOnDiscontinue]`,
`.publishes[ProductContentRetired]`.

Omitted: the inbox on the CloudEvents `id`. The item's own lifecycle
(ACTIVE, discontinued) is `offer-availability`'s; see its
[pack](/network/contexts/offer-availability).

## 5. Projection bootstrap: product-discovery reads the snapshot

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant PD as product-discovery
    participant PC as product-content
    participant K as Kafka
    Note over PD: rebuild ProductView, CategoryView<br/>(snapshot + catch-up, gap S5)
    loop paged
        PD->>PC: qry: ListProductContents<br/>GET /product-contents after, limit
        PC-->>PD: qry: reply page + next
    end
    PD->>PC: qry: ListCategories<br/>GET /categories
    PC-->>PD: qry: reply version + categories
    Note over PD: snapshot loaded
    K->>PD: evt: productcontent.<br/>ProductContentPublished
    Note over PD: catch-up on events,<br/>revision guard
```

Derived from: `model.yaml → contexts[product-content].inbound` (the
`product-discovery` query row), `.rest`;
`contexts[product-discovery].business_decisions` (bootstrap is snapshot +
catch-up), `.sync_calls` (`ListProductContents`).

Omitted: the other bootstrap reads `product-discovery` does against
`offer-availability` and `pricing`; they are not this context's messages.
`GetProductContent` (single item) is the same shape as one page of the
list and is not drawn separately.
