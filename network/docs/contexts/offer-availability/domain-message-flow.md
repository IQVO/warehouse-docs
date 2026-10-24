---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: "Key Offer & Availability scenarios as ddd-crew domain message flows: a feed applied, a feed refused, a node suspended and restored, a catalogue item listed."
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Four scenarios. Participants are contexts and actors, abbreviated by
context code: NF = `network-fulfillment` (the fleet, vendor V-WS),
VC = `vendor-connectivity`, OA = `offer-availability`, NT =
`node-topology`, DP = `delivery-promise`, OS = `order-sourcing`, ST =
`shipping-and-tracking`, NP = `node-performance`. Every arrow is a
message from `model.yaml`, prefixed `cmd:` (command), `qry:` (query) or
`evt:` (event). Event arrows are written `<entity>.<EventName>`; the full
type is `com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/network/contexts/offer-availability/domain-events)). Path
parameters are written without braces. The domain-wide flows are on
[Domain Message Flows](/network/strategic-design/domain-message-flows).

## 1. A full inventory feed is applied (happy path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as NF vendor V-WS
    participant VC
    participant OA
    participant NP
    NF->>VC: cmd: POST /vendor/inventory<br/>SubmitInventory
    VC-->>NF: cmd: reply 202 transactionId
    Note over VC: ProcessSubmission<br/>after notBefore
    VC->>OA: cmd: POST /inventory-feeds<br/>ApplyInventoryFeed<br/>fullUpdate true
    Note over OA: one transaction:<br/>feed RECEIVED, lines applied,<br/>omitted listings zeroed,<br/>feed APPLIED
    OA-->>VC: cmd: reply 201 APPLIED
    OA->>NP: evt: inventoryfeed.<br/>InventoryFeedApplied
    VC->>NP: evt: submission.<br/>SubmissionProcessed SUCCESS
    NF->>VC: qry: GET /vendor/transactions/<br/>transactionId GetTransaction
    VC-->>NF: qry: reply SUCCESS
```

Derived from: `model.yaml → contexts[vendor-connectivity].inbound`,
`.sync_calls`, `.aggregates[Submission]`, `.publishes[SubmissionProcessed]`;
`contexts[offer-availability].aggregates[InventoryFeed]`,
`.publishes[InventoryFeedApplied]`.

The same apply, seen from the availability consumers:

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant VC
    participant OA
    participant DP
    participant OS
    VC->>OA: cmd: POST /inventory-feeds<br/>ApplyInventoryFeed
    Note over OA: per changed listing,<br/>including zeroed ones
    OA->>DP: evt: listing.<br/>ListingAvailabilityChanged
    OA->>OS: evt: listing.<br/>ListingAvailabilityChanged
```

Derived from: `model.yaml → contexts[offer-availability].publishes[ListingAvailabilityChanged]`,
`.policies[FullFeedZeroing]`, `.aggregates[Listing]`;
`contexts[delivery-promise].read_models[AvailabilityView]`,
`contexts[order-sourcing].read_models[AvailabilityView]`.

Omitted: `vendor-connectivity`'s ownership check
(`ErrNodeNotOwnedByVendor`) and rate limiting; the outbox relay between
commit and Kafka, so the event arrows may be seen after the reply; the
listings whose line was stale, which raise no event. One
`ListingAvailabilityChanged` goes out per changed listing; the diagram
shows one arrow per consumer. A partial feed is the same flow without
zeroing.

## 2. A feed is refused, or changes nothing (failure path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as NF vendor V-WS
    participant VC
    participant OA
    participant NP
    NF->>VC: cmd: POST /vendor/inventory<br/>SubmitInventory
    VC-->>NF: cmd: reply 202 transactionId
    VC->>OA: cmd: POST /inventory-feeds<br/>ApplyInventoryFeed
    alt a line names a listing of another node
        Note over OA: ErrListingNotOnNode<br/>feed FAILED
        OA-->>VC: cmd: reply 422<br/>listing-not-on-node
        VC->>NP: evt: submission.<br/>SubmissionProcessed FAILURE
    else a line has a negative quantity
        Note over OA: ErrNegativeAvailability<br/>feed FAILED
        OA-->>VC: cmd: reply 422<br/>negative-availability
        VC->>NP: evt: submission.<br/>SubmissionProcessed FAILURE
    else the feed id was already applied
        Note over OA: ErrFeedAlreadyApplied<br/>nothing changes
        OA-->>VC: cmd: reply 409<br/>feed-already-applied
    else every line is stale
        Note over OA: ErrStaleAvailability<br/>per line, lines ignored,<br/>feed APPLIED
        OA-->>VC: cmd: reply 201 APPLIED
        OA->>NP: evt: inventoryfeed.<br/>InventoryFeedApplied
        VC->>NP: evt: submission.<br/>SubmissionProcessed SUCCESS
    end
    NF->>VC: qry: GET /vendor/transactions/<br/>transactionId GetTransaction
    VC-->>NF: qry: reply SUCCESS<br/>or FAILURE with errors
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[InventoryFeed].invariants`,
`.aggregates[Listing].invariants`, `.publishes[InventoryFeedApplied]`;
`contexts[vendor-connectivity].aggregates[Submission]`,
`.publishes[SubmissionProcessed]`.

Omitted: what `vendor-connectivity` does with a `409` on a feed it already
applied (its `ErrSubmissionAlreadyProcessed` guards its own side). The
problem `type` slugs and status codes are this context's proposed contract
([Use Cases](/network/contexts/offer-availability/use-cases)). Whether a feed
whose lines are all stale should end `APPLIED` is a model gap; this flow
follows the invariant "is ignored".

## 3. A node is suspended, then activated again

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor OPS as ops planner
    participant NT
    participant OA
    participant DP
    participant OS
    OPS->>NT: cmd: POST /nodes/nodeId:suspend<br/>SuspendNode
    NT->>OA: evt: node.NodeSuspended
    Note over OA: NodeStatusView SUSPENDED<br/>SuppressListing on every<br/>LIVE listing of the node
    OA->>DP: evt: listing.<br/>ListingSuppressed
    OA->>OS: evt: listing.<br/>ListingSuppressed
    OPS->>NT: cmd: POST /nodes/nodeId:activate<br/>ActivateNode
    NT->>OA: evt: node.NodeActivated
    Note over OA: NodeStatusView ACTIVE<br/>RestoreListing on those<br/>suppressed for that reason
    OA->>DP: evt: listing.<br/>ListingRestored
    OA->>OS: evt: listing.<br/>ListingRestored
```

Derived from: `model.yaml → contexts[node-topology].inbound`,
`.aggregates[Node].transitions`, `.publishes`;
`contexts[offer-availability].policies[SuppressOnNodeUnavailable]`,
`.read_models[NodeStatusView]`, `.publishes`.

Omitted: one `ListingSuppressed` / `ListingRestored` goes out per
listing; the diagram shows one arrow per consumer. `delivery-promise` and
`order-sourcing` also consume
`NodeSuspended` and `NodeActivated` directly; those arrows are on their
pages. `NodeRetired` follows the first half of this flow and is never
followed by `NodeActivated` (`RETIRED` is terminal in `node-topology`).

## 4. A catalogue item is created, listed and browsed

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor MER as merchandising
    participant OA
    participant DP
    participant ST
    actor SHO as storefront
    MER->>OA: cmd: POST /catalog-items<br/>CreateCatalogItem
    alt dimensions or weight not positive
        OA-->>MER: cmd: reply 422<br/>invalid-item-dimensions
    else valid
        OA-->>MER: cmd: reply 201<br/>catalogItemId
        OA->>DP: evt: catalogitem.<br/>CatalogItemCreated
        OA->>ST: evt: catalogitem.<br/>CatalogItemCreated
    end
    SHO->>OA: qry: GET /catalog<br/>BrowseCatalog
    OA-->>SHO: qry: reply<br/>catalogue items
```

Derived from: `model.yaml → contexts[offer-availability].inbound`,
`.rest`, `.aggregates[CatalogItem]`, `.publishes[CatalogItemCreated]`.

Then the item is listed on a node:

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor MER as merchandising
    participant OA
    participant DP
    participant OS
    participant VC
    MER->>OA: cmd: POST /listings<br/>CreateListing
    alt a listing for this item and node exists
        OA-->>MER: cmd: reply 409<br/>duplicate-listing
    else new listing
        OA-->>MER: cmd: reply 201<br/>listingId
        OA->>DP: evt: listing.<br/>ListingCreated
        OA->>OS: evt: listing.<br/>ListingCreated
        OA->>VC: evt: listing.<br/>ListingCreated
    end
```

Derived from: `model.yaml → contexts[offer-availability].inbound`,
`.rest`, `.aggregates[CatalogItem]`, `.aggregates[Listing].invariants`,
`.publishes`.

Omitted: `DiscontinueItem` (one command, one `CatalogItemDiscontinued` to
`delivery-promise` and `order-sourcing`); the listing has no availability
until the node's first feed names it.
