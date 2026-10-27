---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: "Proposed UML sequence diagrams for every Offer & Availability command use case, from inbound adapter to Kafka through the transactional outbox."
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case of
[Use Cases](/network/contexts/offer-availability/use-cases). Participants, in
order: the inbound adapter (`HTTP` or the Kafka consumer `KC`), the use
case (`UC`), the aggregate (`Item` = `catalog.Item`, `Listing` =
`listing.Listing`, `Feed` = `feed.InventoryFeed`), the Postgres database (`DB`): the
repository and the transactional outbox (the `outbox_events` table), shown
as one participant because the outbox row is written in the same
transaction as the aggregate; then the outbox relay (`Relay`) and Kafka.
Messages to `DB` that start with "outbox" are outbox writes; the others
are repository calls. Inside the diagrams, a hyphen before a line break
splits a long name to keep the diagram narrow (`CatalogItem-Created` is
`CatalogItemCreated`); it is not part of the name.
The grey `rect` is one database transaction. Event arrows to Kafka name
`<entity>.<EventName>` on `retailnetwork.offer-availability.events`; the
full type is `com.retailnetwork.commerce.offer-availability.<entity>.<EventName>`.

Common to every diagram: the relay runs on its own loop, claims
unpublished rows, publishes them as CloudEvents keyed by the aggregate
root id, and marks them published. It is drawn once per diagram.

## 1. CreateCatalogItem

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP
    participant UC as UC
    participant AG as Item
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    HTTP->>UC: POST /catalog-items<br/>Idempotency-Key
    alt key already used
        UC-->>HTTP: stored 201
    else new key
        UC->>AG: NewItem(fields)
        alt dimension or weight not positive
            AG-->>UC: ErrInvalid-<br/>ItemDimensions
            UC-->>HTTP: 422<br/>invalid-<br/>item-dimensions
        else valid
            AG-->>UC: item ACTIVE
            rect rgb(241, 243, 245)
                UC->>DB: Insert(item)
                UC->>DB: outbox Append<br/>Catalog-<br/>ItemCreated
            end
            UC-->>HTTP: 201 item
        end
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: catalogitem.<br/>Catalog-<br/>ItemCreated
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[CatalogItem]`
(`invariants`, `commands`, `events`), `.rest`, `conventions.integration_rules`.

Omitted: the idempotency-key store write (inside the same transaction);
logging and metrics.

## 2. DiscontinueItem

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP
    participant UC as UC
    participant AG as Item
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    HTTP->>UC: POST /catalog-items/<br/>id:discontinue
    UC->>DB: FindByID(id)
    alt not found
        DB-->>UC: none
        UC-->>HTTP: 404 not-found
    else already DISCONTINUED
        DB-->>UC: item
        UC-->>HTTP: 200 item, no event
    else ACTIVE
        DB-->>UC: item, version n
        UC->>AG: Discontinue()
        rect rgb(241, 243, 245)
            UC->>DB: Update(item, version n)
            alt version changed meanwhile
                DB-->>UC: version conflict
                UC-->>HTTP: 409<br/>concurrent-<br/>modification
            else version n matches
                UC->>DB: outbox Append<br/>CatalogItem-<br/>Discontinued
                UC-->>HTTP: 200 item
            end
        end
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: catalogitem.<br/>CatalogItem-<br/>Discontinued
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[CatalogItem].transitions`,
`.events`, `.rest`.

Omitted: the `Idempotency-Key` replay branch (as in diagram 1). The
`404` and the `409 concurrent-modification` have no `Err...` identifier in
the model; they are proposed HTTP behaviour.

## 3. CreateListing

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP
    participant UC as UC
    participant AG as Listing
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    HTTP->>UC: POST /listings<br/>Idempotency-Key
    UC->>DB: NodeStatusView<br/>status(nodeId)
    DB-->>UC: status
    UC->>AG: New-<br/>Listing(itemId,<br/>nodeId, active)
    AG-->>UC: listing LIVE,<br/>or SUPPRESSED
    rect rgb(241, 243, 245)
        UC->>DB: Insert(listing)
        alt unique key item and node taken
            DB-->>UC: ErrDuplicate-<br/>Listing
            UC-->>HTTP: 409<br/>duplicate-<br/>listing
        else inserted
            UC->>DB: outbox Append<br/>ListingCreated
            UC-->>HTTP: 201 listing
        end
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: listing.<br/>ListingCreated
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[Listing]`
(`invariants[ErrDuplicateListing]`, `invariants[ErrNodeNotSellable]`),
`.read_models[NodeStatusView]`, `.publishes[ListingCreated]`.

Omitted: the `Idempotency-Key` replay branch. Starting `SUPPRESSED` on a
non-`ACTIVE` node is the proposed reading of `ErrNodeNotSellable` (model
gap H3). A failed insert rolls the transaction back, so no outbox row
exists for it.

## 4. ApplyInventoryFeed

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP
    participant UC as UC
    participant AG as Feed
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    HTTP->>UC: POST /inventory-feeds<br/>Idempotency-Key
    alt key already used
        UC-->>HTTP: stored answer
    else new key
        UC->>DB: Find-<br/>Feed(feedId)
        alt feed APPLIED
            UC-->>HTTP: 409<br/>feed-<br/>already-applied
        else unknown feed
            UC->>AG: Receive(header, lines)
            UC->>DB: listings of nodeId,<br/>with versions
            loop each line
                Note over UC: listing on nodeId, else<br/>ErrListingNotOnNode
                Note over UC: ApplyAvailability,<br/>see diagram 5
            end
            opt fullUpdate
                Note over UC: FullFeedZeroing: qty 0<br/>on omitted listings
            end
            alt a line failed
                UC->>AG: Mark-<br/>Failed(cause)
                UC->>DB: Save(feed FAILED)
                UC-->>HTTP: 422 listing-not-<br/>on-node<br/>or negative-<br/>availability
            else all lines applied or stale
                UC->>AG: Mark-<br/>Applied(now)
                rect rgb(241, 243, 245)
                    UC->>DB: Save(feed APPLIED)
                    UC->>DB: Update listings,<br/>version checks
                    alt a version changed
                        DB-->>UC: conflict, roll back
                        Note over UC: re-run from<br/>loading listings
                    else versions match
                        UC->>DB: outbox Append Listing-<br/>Availability-<br/>Changed x n
                        UC->>DB: outbox Append<br/>Inventory-<br/>FeedApplied
                    end
                end
                UC-->>HTTP: 201 feed APPLIED
            end
        end
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: listing.Listing-<br/><br/>Availability-<br/>Changed
    Relay->>Kafka: inventoryfeed.<br/>Inventory-<br/>FeedApplied
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[InventoryFeed]`
(`states`, `transitions`, `invariants`), `.aggregates[Listing].invariants`,
`.policies[FullFeedZeroing]`, `.publishes`, `.rest`;
`contexts[vendor-connectivity].sync_calls`.

Omitted: the case of a `FAILED` `feedId` sent again (proposed: replay the
stored `422`). `ListingAvailabilityChanged` is written once per changed
listing; stale lines write nothing. The `RECEIVED` state exists only
inside the apply: the feed row is first written as `APPLIED` or `FAILED`.


## 5. ApplyAvailability

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant UC as UC ApplyInventoryFeed
    participant AG as listing.Listing
    participant Outbox
    UC->>AG: Apply-<br/>Availability(qty,<br/>basis, asOf, feedId)
    alt asOf not after current asOf
        AG-->>UC: ErrStale-<br/>Availability
        Note over UC: line ignored,<br/>no event
    else qty below zero
        AG-->>UC: ErrNegative-<br/>Availability
        Note over UC: feed will be FAILED
    else accepted
        AG-->>UC: Availability replaced,<br/>basis kept as given
        Note over UC,Outbox: ListingAvailabilityChanged<br/>appended in the feed's transaction
    end
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[Listing]`
(`value_objects`, `invariants[ErrNegativeAvailability]`,
`invariants[ErrStaleAvailability]`), `.business_decisions`.

Omitted: the inbound adapter, repository, relay and Kafka: this command
has no adapter of its own and commits inside diagram 4's transaction.

## 6. SuppressListing

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC
    participant UC as UC
    participant AG as Listing
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    KC->>UC: node.Node-<br/>Suspended<br/>or node.Node-<br/>Retired
    UC->>DB: processed_events<br/>has id?
    alt already processed
        UC-->>KC: ack, no change
    else new id
        UC->>DB: LIVE listings<br/>of nodeId
        loop each LIVE listing
            UC->>AG: Suppress(reason)
        end
        rect rgb(241, 243, 245)
            UC->>DB: NodeStatus-<br/>View,<br/>listings, inbox row
            alt a version changed
                DB-->>UC: conflict, roll back
                UC-->>KC: nack, redelivered
            else versions match
                UC->>DB: outbox Append<br/>Listing-<br/>Suppressed x n
                UC-->>KC: ack
            end
        end
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: listing.<br/>Listing-<br/>Suppressed
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].policies[SuppressOnNodeUnavailable]`,
`.consumes`, `.read_models[NodeStatusView]`, `.aggregates[Listing]`,
`.publishes[ListingSuppressed]`; `conventions.integration_rules`.

Omitted: the consumer dispatches on the full type
(`com.retailnetwork.logistics.node-topology.node.NodeSuspended`,
`com.retailnetwork.logistics.node-topology.node.NodeRetired`).
`NodeRegistered` only inserts the view row and is not drawn.

## 7. RestoreListing

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC
    participant UC as UC
    participant AG as Listing
    participant DB as Repo + Outbox
    participant Relay
    participant Kafka
    KC->>UC: node.Node-<br/>Activated
    UC->>DB: processed_events<br/>has id?
    alt already processed
        UC-->>KC: ack, no change
    else new id
        UC->>DB: set NodeStatusView ACTIVE,<br/>listings suppressed for<br/>node unavailability
        loop each such listing
            UC->>AG: Restore(active)
            alt node not ACTIVE in view
                AG-->>UC: ErrNodeNot-<br/>Sellable
                Note over UC: listing stays<br/>SUPPRESSED
            else ACTIVE
                AG-->>UC: listing LIVE
            end
        end
        rect rgb(241, 243, 245)
            UC->>DB: view, listings,<br/>inbox row
            UC->>DB: outbox Append<br/>Listing-<br/>Restored x n
        end
        UC-->>KC: ack
    end
    Relay->>DB: claim unpublished<br/>outbox rows
    Relay->>Kafka: listing.<br/>Listing-<br/>Restored
    Relay->>DB: mark published
```

Derived from: `model.yaml → contexts[offer-availability].policies[SuppressOnNodeUnavailable]`,
`.aggregates[Listing].invariants[ErrNodeNotSellable]`,
`.publishes[ListingRestored]`; `conventions.integration_rules`.

Omitted: the version-conflict branch (as in diagram 6). The consumer
dispatches on `com.retailnetwork.logistics.node-topology.node.NodeActivated`.
Which suppression reasons count as "node unavailability" is model gap H6.
