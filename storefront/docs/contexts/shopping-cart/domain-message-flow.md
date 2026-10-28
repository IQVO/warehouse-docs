---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Shopping Cart scenarios as ddd-crew domain message flows, covering cart building with a delivery quote, a price change landing, tier selection per shipment group, and checkout closing the cart.
---

# Domain Message Flow

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Four scenarios. Participants are contexts and actors. Every arrow is a
message from the model, prefixed `cmd:` (command), `qry:` (query) or `evt:`
(event). A `Note` names a command a context runs on itself. Kafka is drawn
as one participant. Event names are written `entity.EventName`; the full
type is `com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/storefront/contexts/shopping-cart/domain-events)). REST path
parameters are written without braces. The storefront-wide flows follow from
the [Context Map](/storefront/strategic-design/context-map).

## 1. A shopper builds a cart and quotes delivery

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor S as Shopper
    participant BFF as storefront-bff
    participant SC as shopping-cart
    participant DP as delivery-promise
    participant K as Kafka analytics
    S->>BFF: add to cart, set destination
    BFF->>SC: cmd: CreateCart<br/>POST /carts
    SC-->>BFF: cmd: reply 201 cartId
    BFF->>SC: cmd: AddLine<br/>POST /carts/cartId/lines
    Note over SC: ErrItemNotPurchasable against<br/>PurchasabilityView,<br/>ErrQuantityOutOfRange,<br/>ErrTooManyLines
    SC->>K: evt: cart.CartLineAdded
    SC-->>BFF: cmd: reply 200 cart
    BFF->>SC: cmd: SetDestination<br/>POST /carts/cartId:set-destination
    Note over SC: clears quote and selections
    BFF->>SC: cmd: QuoteDelivery<br/>POST /carts/cartId:quote-delivery
    Note over SC: ErrNoDestination without a prefix
    SC->>DP: qry: QuoteDeliveryOffers<br/>POST /delivery-offers:quote
    DP-->>SC: qry: reply groups, offers,<br/>windows, expiries,<br/>unavailable tiers
    Note over SC: quote held, holds no capacity
    SC->>K: evt: cart.CartDeliveryQuoted
    SC-->>BFF: cmd: reply 200 cart with quote<br/>and labelled estimate
```

Derived from: `model.yaml → contexts[shopping-cart].inbound`
(BFF rows), `.aggregates[Cart].commands` + `.invariants`,
`.sync_calls`, `.publishes[CartLineAdded, CartDeliveryQuoted]`;
`network/model/model.yaml → contexts[delivery-promise].inbound`
(caller `shopper / storefront`, `QuoteDeliveryOffers`).

Omitted: the outbox write and relay (see
[Sequence Diagrams](/storefront/contexts/shopping-cart/sequence-diagrams));
the merge of a re-added item's quantities (the event carries the merged
line); `SetLineQuantity`, `RemoveLine` and `MergeInto`, which share
AddLine's shape.

## 2. A price, charge or tax change lands

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant PR as pricing
    participant K as Kafka
    participant SC as shopping-cart
    participant BFF as storefront-bff
    PR->>K: evt: itemprice.ItemPriceChanged
    K->>SC: evt: itemprice.ItemPriceChanged
    Note over SC: EstimateView effective price,<br/>PurchasabilityView
    PR->>K: evt: deliverychargeschedule.<br/>DeliveryChargeScheduleChanged
    K->>SC: evt: deliverychargeschedule.<br/>DeliveryChargeScheduleChanged
    Note over SC: EstimateView tier charges,<br/>store the version
    PR->>K: evt: taxtable.TaxTableChanged
    K->>SC: evt: taxtable.TaxTableChanged
    Note over SC: EstimateView tax bands,<br/>store the version
    Note over SC: no cart event:<br/>lines and quote untouched
    BFF->>SC: qry: GetCart GET /carts/cartId
    SC-->>BFF: qry: reply cart,<br/>estimate recomputed at read
```

Derived from: `model.yaml → contexts[shopping-cart].consumes` (pricing
rows), `.read_models[PurchasabilityView, EstimateView]`;
`contexts[pricing].publishes`.

Omitted: `ItemPriceWithdrawn` (same channel: the item stops being
purchasable and the estimate can no longer price the line) and
`CatalogItemCreated` / `CatalogItemDiscontinued` from
`offer-availability`, which feed `PurchasabilityView` the same way. The
quote is never cleared by a price event — only a line or destination
change clears it (business decision 3).

## 3. The shopper selects a delivery offer per group

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor S as Shopper
    participant BFF as storefront-bff
    participant SC as shopping-cart
    S->>BFF: pick a tier per shipment group
    BFF->>SC: cmd: SelectDelivery<br/>POST /carts/cartId:select-delivery
    alt the offer is not of the current quote
        SC-->>BFF: cmd: reply 409<br/>ErrStaleDeliverySelection
    else quote already cleared by a change
        SC-->>BFF: cmd: reply 409<br/>ErrStaleDeliverySelection
    else the offer belongs to the quote
        Note over SC: selections groupNo to offerId.<br/>estimate adds the tier charges.<br/>CheckoutReadiness: every group<br/>selected, no offer expired
        SC-->>BFF: cmd: reply 200 cart,<br/>estimate, readiness
    end
```

Derived from: `model.yaml → contexts[shopping-cart].inbound` (BFF cmd row),
`.aggregates[Cart]` (`DeliverySelection` value object, `ErrStaleDeliverySelection`,
`commands[SelectDelivery]`), `.read_models[CheckoutReadiness, EstimateView]`.

Omitted: the expiry comparison (readiness compares each `QuotedOffer`'s
`expiresAt` with the clock; no event announces an expiry) and the estimate
arithmetic (effective prices plus selected tier charges plus the tax band
of the destination prefix).

## 4. Checkout reads the cart and completes it

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor S as Shopper
    participant CK as checkout
    participant SC as shopping-cart
    participant K as Kafka
    participant AN as Kafka analytics
    S->>CK: cmd: OpenSession<br/>POST /checkout-sessions
    CK->>SC: qry: GetCart<br/>GET /carts/cartId
    Note over CK: ErrCartNotCheckoutReady:<br/>the cart's CheckoutReadiness<br/>must hold at session open
    SC-->>CK: qry: reply cart, version,<br/>groups, selections, readiness
    Note over CK: saga runs: quote, authorize,<br/>place the order (its own pack)
    CK->>K: evt: checkoutsession.<br/>CheckoutCompleted
    K->>SC: evt: checkoutsession.<br/>CheckoutCompleted
    Note over SC: CloseOnCheckoutCompleted:<br/>OPEN to CHECKED_OUT<br/>ErrCartClosed if not OPEN
    SC->>AN: evt: cart.CartCheckedOut<br/>checkoutSessionId
```

Derived from: `model.yaml → contexts[checkout].sync_calls` (`GetCart`),
`.invariants[ErrCartNotCheckoutReady]`, `.publishes[CheckoutCompleted]`;
`contexts[shopping-cart].inbound` (checkout rows), `.policies[CloseOnCheckoutCompleted]`,
`.publishes[CartCheckedOut]`.

Omitted: the saga itself (pricing's `PriceQuote`, `customer-payments`,
the network's `PlaceOrder` through checkout's ACL — checkout's own pages);
the inbox on the CloudEvents `id`; and the offer pre-check checkout runs
against `delivery-promise` (`GetDeliveryOffer`) before authorizing, which
is checkout's edge, not the cart's.
