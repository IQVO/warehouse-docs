---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "Every term of the digital-storefront domain, the context that owns it, its code identifier, and the network term it must not be confused with."
---

# Ubiquitous Language

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Each term belongs to the context that owns its meaning. Where the same word
means something else in the retail network, the network counterpart is named.
Code identifiers are the proposed Go package and type names.

| Term | Context | Definition | Not to be confused with | Code identifier |
| --- | --- | --- | --- | --- |
| **Allocation** | `checkout` | The share of an authorization that belongs to one shipment group. | - | `session.SessionGroup.Amount` |
| **Capture** | `customer-payments` | Taking an allocation's money when its shipment group ships. | authorize (the hold at checkout) | `authorization.Allocation.Capture` |
| **Cart** | `shopping-cart` | One shopper's held intent: lines, destination, delivery quote and selections. | - | `cart.Cart` |
| **Category** | `product-content` | One node of the browsable category tree. | - | `category.Category` |
| **Category Tree** | `product-content` | The single, versioned tree of categories, at most four levels deep. | - | `category.CategoryTree` |
| **Category View** | `product-discovery` | The browsable tree with purchasable counts per category. | - | `categoryview.CategoryView` |
| **Checkout Readiness** | `shopping-cart` | Every group selected and no offer expired. | - | `cart.CheckoutReadiness` |
| **Checkout Session** | `checkout` | The purchase transaction from review to placed order. | the network's "Checkout" (customer-ordering PlaceOrder), which is the session's place-order step | `session.CheckoutSession` |
| **Delivery Charge** | `pricing` | The price of one service tier's speed, with an optional free-over threshold. | - | `schedule.TierCharge` |
| **Delivery Quote (cart)** | `shopping-cart` | The offers delivery-promise returned for the cart's lines and destination, held by the cart; a quote holds no capacity. | the network's DeliveryOffer (one offer) | `cart.DeliveryQuote` |
| **Delivery Selection** | `shopping-cart` | The offer the shopper picked per shipment group. | - | `cart.DeliverySelection` |
| **Effective Price** | `pricing` | The lowest active sale price, else the list price. | - | `itemprice.ItemPrice.EffectivePrice` |
| **Estimate** | `shopping-cart` | The labelled, non-binding total in the cart: effective prices plus selected tier charges plus tax band. | the binding PriceQuote of a checkout session | `cart.Estimate` |
| **In Stock** | `product-discovery` | At least one LIVE listing with availableQty > 0 for the item. | - | `productview.InStock` |
| **In-Doubt Placement** | `checkout` | The place-order outcome is unknown (timeout or 503); PLACING holds the semantic lock until the resolver settles it. | - | `session.PlacementInDoubt` |
| **List Price** | `pricing` | The item's standing price; a sale price is always below it. | - | `itemprice.ItemPrice.ListPrice` |
| **Payment Authorization** | `customer-payments` | A hold on the shopper's payment method for the quote total, split into allocations per shipment group. | - | `authorization.PaymentAuthorization` |
| **Payment Method Token** | `customer-payments` | The PSP token standing in for the shopper's card; the storefront never sees a card number. | - | `(provider port)` |
| **Place-Order Step** | `checkout` | The pivot of the saga: customer-ordering POST /checkout through the ACL. | - | `session.PlaceOrder` |
| **Price Quote** | `pricing` | A binding, immutable, expiring price snapshot for one checkout. | the cart estimate (non-binding) | `quote.PriceQuote` |
| **Primary Medium** | `product-content` | The one image a product page leads with; exactly one per published content. | - | `content.Media.RolePrimary` |
| **Product Content** | `product-content` | Description, bullets, attributes and media of one catalogue item. | - | `content.ProductContent` |
| **Product View** | `product-discovery` | The projection one product page or search hit renders from. | - | `productview.ProductView` |
| **Product-Type Query** | `product-discovery` | A search for a kind of product; the answer includes category suggestions. | - | `(search policy)` |
| **Purchasable** | `product-discovery` | Item ACTIVE in the item master, content PUBLISHED, price ACTIVE, and at least one LIVE listing with quantity > 0. | the network's sellable listing (one node only) | `productview.Purchasable` |
| **Reauthorization** | `customer-payments` | A fresh authorization replacing one about to expire, for allocations not yet captured. | - | `authorization.Reauthorize` |
| **Refund** | `customer-payments` | Returning captured money for a lost or returned package, or manually. | - | `refund.Refund` |
| **Release** | `customer-payments` | Letting an uncaptured allocation go when its group is cancelled. | - | `authorization.Allocation.Release` |
| **Requote** | `checkout` | A definitive 409 from the network: the authorization is voided and the session carries the re-quoted offers for the cart. | - | `session.RequotedOffer` |
| **Revision** | `product-content` | One published shape of an item's content; publishing bumps it. | - | `content.ProductContent.Revision` |
| **Sale Window** | `pricing` | A time-bounded sale price for one item; windows never overlap. | - | `itemprice.SaleWindow` |
| **Storefront Edge** | `storefront (domain-wide)` | The only routes a browser reaches: /api/storefront/* on the BFF. | in-org network routes | `(experience layer)` |
| **Tax Band** | `pricing` | A basis-point rate for a destination postal-prefix range (synthetic, D10). | - | `tax.TaxBand` |
| **Void** | `customer-payments` | Cancelling the whole authorization before any capture. | - | `authorization.Void` |

## Network terms the storefront relies on

These terms belong to the retail network (see
[its ubiquitous language](/network/strategic-design/ubiquitous-language)); the
storefront conforms to them: Catalog Item (`catalogItemId`, the only cross-domain
join key), Listing, Delivery Offer, Service Tier (SAME_DAY, NEXT_DAY, TWO_DAY,
STANDARD), Promise, Shipment Group, Tracking Number, Customer Order, Shopper,
Ship-To. PII terms (Ship-To, names, e-mail) live only in `customer-ordering`;
the storefront stores `shopperId` and `shipToAddressId` references, never the
data.

