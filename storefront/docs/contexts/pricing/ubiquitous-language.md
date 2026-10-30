---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Pricing speaks, each mapped to its code identifier on develop, plus the neighbour terms it uses and the terms most often confused with them.
---

# Ubiquitous Language

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `pricing` service is built on develop ([`IQVO/pricing`](https://github.com/IQVO/pricing) at `5a18326`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/pricing#service-and-operations) section lists it.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its aggregates. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[pricing].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **List Price** | The item's standing price; a sale price is always below it. | `itemprice.ItemPrice.ListPrice` | **Effective Price**: what the shopper actually pays when a sale is active. |
| **Sale Window** | A time-bounded sale price for one item; windows never overlap. | `itemprice.SaleWindow` | A promotion or coupon (later phase, D10). |
| **Effective Price** | The lowest active sale price, else the list price. | `itemprice.ItemPrice.EffectivePrice` | The **Estimate** in `shopping-cart`: an estimate combines effective prices with charges and tax and is non-binding. |
| **Delivery Charge** | The price of one service tier's speed, with an optional free-over threshold. | `schedule.TierCharge` | The network's **Service Tier** itself (the promise); this context only prices it. |
| **Tax Band** | A basis-point rate for a destination postal-prefix range (synthetic, D10). | `tax.TaxBand` | A real jurisdiction's tax rule; this table is synthetic by decision. |
| **Price Quote** | A binding, immutable, expiring price snapshot for one checkout. | `quote.PriceQuote` | The cart estimate (non-binding); and the network's delivery **offer** quote, which prices time, not money. |

## Model elements of this context

Derived from: `model.yaml → contexts[pricing].aggregates[*]` (`value_objects`, `states`, `commands`), `read_models`, `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Money** | An amount in integer minor units of the one configured currency. | `itemprice.Money{amountMinor, currency}` | A decimal or float amount; mixing currencies raises `ErrCurrencyMismatch`. |
| **Item Price** | The list price and sale windows of one catalogue item, versioned. | `itemprice.ItemPrice` | The catalogue item itself (`offer-availability`). |
| **Delivery Charge Schedule** | The charge per service tier, one current version at a time. | `schedule.DeliveryChargeSchedule` | The network's promise per tier. |
| **Tax Table** | The synthetic basis-point rates by postal-prefix band, one current version. | `tax.TaxTable` | A bought tax engine (later phase). |
| **Quote Line** | One priced line of a quote: item, quantity, unit price, line total. | `quote.Line` | A cart line (`shopping-cart`): the quote line's price is binding, the cart line's is not. |
| **Quote Group** | One shipment group of a quote: group number, tier, delivery charge. | `quote.Group` | The network's shipment group (`delivery-promise`); this is only its price. |
| **Catalog Item View** | The local, event-fed copy of which catalogue items exist and are not discontinued. | `CatalogItemView` | The item master in `offer-availability`, which is authoritative. |
| **Quote TTL** | Policy: a PriceQuote expires 15 minutes (default) after issue; expiry is by time, immutable otherwise. | `QuoteTtl` | A delivery offer's expiry (network): an expiring offer holds no money amount. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`, [network](/network/contexts/offer-availability)) | **Item Price**: this context's price of that item. The item master stays upstream. |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `promise.Tier` (`delivery-promise`, [network](/network/contexts/delivery-promise)) | **Delivery Charge**: the price this context puts on the tier. `TierCharge` re-declares the enum locally; there is no shared kernel. |
| **Checkout Session** | The purchase transaction from review to placed order. | `checkoutsession.CheckoutSession` (`checkout`) | The **Price Quote** it is confirmed against; the session orchestrates, the quote only prices. |
| **Estimate** | The labelled, non-binding total in the cart. | `estimate.Estimate` (`shopping-cart`) | The binding **Price Quote**. The cart's own UL marks this as the term not to confuse. |
| **Purchasable** | Item ACTIVE, content PUBLISHED, price ACTIVE, at least one LIVE listing with stock. | `productview.Purchasable` (`product-discovery`) | **ACTIVE price**: one of the four inputs, not the verdict. |

## Fleet translation

None. Pricing never touches the warehouse-systems fleet and never produces
or consumes a `warehouse.*` topic (`meta.hard_boundary`).
