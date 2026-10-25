---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Product Content speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses and the terms most often confused with them.
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model carries the proposed contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its aggregates. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[product-content].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Product Content** | Description, bullets, attributes and media of one catalogue item. | `content.ProductContent` | **Catalog Item** (`offer-availability`): the network's own entry for the product, with the title, dimensions and GTIN. Content never redefines the item; only `catalogItemId` crosses the boundary. |
| **Revision** | One published shape of an item's content; publishing bumps it. | `content.ProductContent.Revision` | The optimistic-concurrency `version` a save checks. A revision is what `product-discovery` orders content by; the version is a storage detail. |
| **Primary Medium** | The one image a product page leads with; exactly one per published content. | `content.Media.RolePrimary` | A GALLERY medium: any other picture of the item. Publish fails without exactly one PRIMARY (`ErrIncompleteContent`). |
| **Category** | One node of the browsable category tree. | `category.Category` | A **primary category**: the one category a content names by `primaryCategoryId`. Every category is a node; only one per content is primary. |
| **Category Tree** | The single, versioned tree of categories, at most four levels deep. | `category.CategoryTree` | The catalogue (`offer-availability`): the tree orders browsing, not the item master. |

## Model elements of this context

Derived from: `model.yaml → contexts[product-content].aggregates[*]` (`value_objects`, `states`, `commands`), `read_models`, `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Attribute** | One named fact of the item: `name`, `value`, optional `unit`. At most 50 per content. | `content.Attribute{name, value, unit?}` | A filter facet of `product-discovery`: facets are derived from attributes, not defined here. |
| **Media** | One picture reference: `mediaId`, `url`, `altText`, `role` PRIMARY or GALLERY. At most 12 per content. URLs to static assets only; upload is out of scope. | `content.Media{mediaId, url, altText, role}` | An uploaded asset: this context never stores bytes. |
| **Bullet** | One line of the bullet list under the title. At most 10 per content. | `content.ProductContent` bullets | An attribute: a bullet is prose, an attribute is a named value. |
| **Content state** | `DRAFT`, `PUBLISHED` or `RETIRED`. RETIRED never publishes again. | `content.ProductContent` states | The item's state in the item master (`offer-availability`): an item is ACTIVE or discontinued there; content has its own lifecycle. |
| **Tree state** | `DRAFT` or `PUBLISHED`; publishing a tree bumps its version. The model marks these states as the least-surprising reading of "single, versioned". | `category.CategoryTree` states | A content's state: a PUBLISHED tree and PUBLISHED content are independent facts. |
| **Catalog Item View** | The local, event-fed read model of the items the network knows; the existence check behind `ErrUnknownCatalogItem`. | `CatalogItemView` | The item master itself (`offer-availability`): this is a projection, never the source of truth. |
| **Retire On Discontinue** | Policy: on `CatalogItemDiscontinued`, retire the item's PUBLISHED content. | `RetireOnDiscontinue` | `RetireContent` from the content manager (REST): the policy runs the same command, without a human. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`) | **Product Content**: this context's sellable description of that item. The title stays the item master's. |
| **Purchasable** | Item ACTIVE in the item master, content PUBLISHED, price ACTIVE, and at least one LIVE listing with quantity above zero. | `productview.Purchasable` (`product-discovery`) | Published: PUBLISHED content is one of the four conditions, never the verdict. |
| **Product View** | The projection one product page or search hit renders from. | `productview.ProductView` (`product-discovery`) | Product Content: the view folds this context's events together with the item master, listings and prices. |
| **Category View** | The browsable tree with purchasable counts per category. | `categoryview.CategoryView` (`product-discovery`) | Category Tree: the view adds purchasable counts to this context's published tree. |

## Fleet translation

None. The storefront never touches the warehouse-systems fleet
(`meta.hard_boundary`); this context consumes only `offer-availability`
events and serves only `product-discovery`.
