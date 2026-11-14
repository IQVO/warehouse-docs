---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every Product Discovery use case — the three read routes, the projector that folds eleven event types, and the ops-run bootstrap rebuild — with actor, adapter, preconditions, main flow, error mapping and idempotency.
---

# Use Cases

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

`contexts[product-discovery].aggregates` is empty, so there is **no command
use case** in this context. The application services are: the three
**queries** of `.rest` (called by the experience layer), the **projector**
that folds the eleven consumed events into `ProductView` and `CategoryView`,
and the ops-run **bootstrap rebuild** of business decision 5. They are
application services in `internal/application/usecases` (as built). The
step-by-step diagrams are on
[Sequence Diagrams](/storefront/contexts/product-discovery/sequence-diagrams);
the payloads are on [Domain Events](/storefront/contexts/product-discovery/domain-events);
the REST contract is `apis/product-discovery/openapi.yaml`.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `SearchProducts` | Shopper via `storefront-bff` | REST `GET /products` | none |
| `GetProduct` | Shopper via `storefront-bff` | REST `GET /products/{catalogItemId}` | none |
| `ListCategories` | Shopper via `storefront-bff` | REST `GET /categories` | none |
| `FoldEvent` (projector) | A consumed event on one of three topics | Kafka consumer | none (a projection write) |
| `RebuildProjections` | Storefront operator (ops) | ops job / CLI | none |

Nothing is ever emitted: `publishes: []`. No `Idempotency-Key` appears
either — the fleet rule binds it to every **write** route, and this context
has none.

## How reads and folds commit

- **Reads** (`SearchProducts`, `GetProduct`, `ListCategories`) run outside
  any transaction on one query against the projections and the search
  index; they write nothing, so they are trivially retryable and safe to
  load-balance.
- **Folds** run one short transaction per event: insert the CloudEvents
  `id` into `processed_events`, apply the per-source guard, update the
  `ProductView` (or replace the `CategoryView`), recompute `inStock` and
  `purchasable`, and — when an indexed column changed — refresh the search
  row. A duplicate `id` or a stale guard is acknowledged without effect.
- **The rebuild** holds no locks a shopper can feel: it writes the
  projections from the snapshot, then consumes from recorded offsets; the
  guards make the snapshot/events overlap safe, and it **never** runs on a
  user request.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>`. The model names no `Err` for this context (see the
[Aggregate Design Canvas](/storefront/contexts/product-discovery/aggregate-design-canvas)); the
read-only REST surface answers these problems:

| Status | Slug | When |
| --- | --- | --- |
| 400 | `invalid-limit` | `limit` empty, repeated, not an integer or outside 1..500 |
| 400 | `invalid-cursor` | `cursor` repeated, or not a cursor of this search (another sort or matching mode) |
| 400 | `unknown-query-parameter` | a query parameter `GET /products` does not declare, for example the retired `after` |
| 400 | `malformed-request` | a NUL character in the query string, on any route |
| 404 | `not-found` | no such product, a stub row, or an id longer than 128 characters |
| 404 | `resource-not-found` | a NUL character in the request path, on any route |
| 422 | `validation-failed` | a filter out of range or of the wrong type: `q` longer than 200 characters, an unknown `sort`, a non-boolean `inStock`, a non-integer, negative or inverted price bound |
| 500 | `internal-error` | anything else; the detail never carries the internal message |

## SearchProducts

- **Actor / trigger:** the shopper, via `storefront-bff` (experience
  layer).
- **Inbound adapter:** REST `GET /products` with `q`, `categoryId`,
  `inStock`, `priceMin`, `priceMax`, `sort`, `cursor`, `limit` (1..500,
  default 100). Any other query parameter is refused as
  `unknown-query-parameter`: the retired `after` fails loudly.
- **Preconditions:** none (the projections are always readable; an empty
  index answers empty).
- **Main flow:**
  1. Validate the parameters: 400 `invalid-limit` for a `limit` outside
     1..500 (or empty, repeated, not an integer), 400 `invalid-cursor` for a
     bad or foreign `cursor`, 400 `unknown-query-parameter` for an undeclared
     parameter; 422 `validation-failed` on a bad `sort`, a negative or
     inverted price bound, a non-boolean `inStock` or a `q` over 200
     characters.
  2. Run the query through the `SearchPort`: full-text search over the
     `tsvector` (weights title A, category names A, attributes B,
     description C — business decision 2), filters ANDed (`categoryId`,
     `inStock`, price band), keyset pagination on the opaque `cursor`.
  3. When full-text search returns too little, retry with `pg_trgm`
     similarity (the typo fallback; the trigger is this pack's reading).
  4. Compute the facets (category, price band, in-stock) over the same
     filtered rows.
  5. For a product-type query, add `categorySuggestions` (business
     decision 3; detection rule not modelled).
  6. Answer `200` with `items`, `facets`, `categorySuggestions`,
     `nextCursor` (absent on the last page); pass it back unchanged as
     `cursor`, with the same filters and sort.
- **Errors:** 400 `invalid-limit` / `invalid-cursor` /
  `unknown-query-parameter` / `malformed-request`; 422 `validation-failed`
  (table above).
- **Idempotency:** a pure read; no key needed.
- **Risk:** ranking quality is fixed by decision 2 — no learning loop,
  and no analytics event exists to build one on (see the
  [canvas](/storefront/contexts/product-discovery/bounded-context-canvas)
  open questions).

## GetProduct

- **Actor / trigger:** the shopper, via `storefront-bff`.
- **Inbound adapter:** REST `GET /products/{catalogItemId}`.
- **Preconditions:** none.
- **Main flow:**
  1. Load the `ProductView` row by `catalogItemId`.
  2. Absent row: 404 `not-found`.
  3. Present row: answer `200` with the full view — title, flags,
     content, category path, list and effective price, `inStock`,
     `purchasable`. An unpurchasable item is still returned: the page
     renders it as currently unavailable (`UnavailableNotBuyable`, gap S6);
     buying out-of-stock is impossible in this network.
- **Errors:** 404 `not-found` (no such product, a stub row, an id over 128
  characters); 400 `malformed-request` for a NUL in the query string.
- **Idempotency:** a pure read.
- **Risk:** the row can lag its sources by one consumer window (the
  freshness metric on the canvas); a just-withdrawn price can still show
     for seconds. The alternative — calling upstream synchronously — is
  what this context exists to avoid.

## ListCategories

- **Actor / trigger:** the shopper, via `storefront-bff`.
- **Inbound adapter:** REST `GET /categories`.
- **Preconditions:** at least one `CategoryTreePublished` consumed (or the
  bootstrap read done).
- **Main flow:**
  1. Load the current `CategoryView` (one `version`, the whole tree).
  2. Answer `200` with `version` and `categories`
     (`categoryId`, `parentId`, `name`, `path`, `purchasableCount`).
- **Errors:** none modelled (an unbuilt tree answers an empty list).
- **Idempotency:** a pure read.
- **Risk:** the counts derive from `ProductView`, so they lag item facts
  by the same consumer window; and a renamed category updates this view
  but not the products' indexed `categoryPath` (hotspot H3 on
  [EventStorming](/storefront/contexts/product-discovery/eventstorming)).

## FoldEvent (the projector)

- **Actor / trigger:** a consumed CloudEvents event on
  `retailnetwork.offer-availability.events`,
  `retailnetwork.product-content.events` or `retailnetwork.pricing.events`.
- **Inbound adapter:** the Kafka consumer of the corresponding consumer
  group; dispatch on the full type string.
- **Preconditions:** none — any event may arrive in any order across
  keys; the row appears on its first fact and fills in.
- **Main flow:**
  1. Look up the CloudEvents `id` in `processed_events`; on a hit,
     acknowledge without effect.
  2. Apply the per-source guard; on a stale `asOf`/`revision`/`version`,
     record the id and acknowledge without effect.
  3. Fold the fact and recompute `inStock` then `purchasable`
     (`PurchasableRule`) in the same transaction.
  4. Refresh the search row when an indexed column changed.

  Per-type effects:

| Event | Guard | Effect |
| --- | --- | --- |
| `CatalogItemCreated` | — | row created; title, flags; item ACTIVE |
| `CatalogItemDiscontinued` | — | item DISCONTINUED; `purchasable` false |
| `ListingCreated` | — | listing row; mapping learned |
| `ListingAvailabilityChanged` | `asOf` | quantity; `inStock` recomputed |
| `ListingSuppressed` | — | listing SUPPRESSED; never counts |
| `ListingRestored` | — | listing LIVE again |
| `ProductContentPublished` | `revision` | content replaced; row re-indexed |
| `ProductContentRetired` | — | content no longer PUBLISHED; `purchasable` false |
| `CategoryTreePublished` | `version` | `CategoryView` replaced; counts re-derived |
| `ItemPriceChanged` | `version` | effective price; `purchasable` recomputed |
| `ItemPriceWithdrawn` | — | price WITHDRAWN; `purchasable` false |

- **Errors:** none — nothing is rejected; the worst case is a skipped
  stale event.
- **Idempotency:** the inbox plus the guards (above).
- **Risk:** `ListingSuppressed`/`ListingRestored` carry only `listingId`,
  so the fold depends on the stored `ListingCreated` mapping (hotspot H1). A
  suppress or restore for a listing the mapping does not know (arriving
  before its create, or the create predates retention) is acknowledged and
  logged as skipped (WARN): not retried and not dead-lettered; the
  bootstrap rebuild repairs the listing (service ADR 0002 A1). On a healthy
  topic this cannot happen, because both events share the listing key with
  `ListingCreated`. Bullets, media and the list price are rendered by
  the page but not declared in `consumes` (hotspot H2).

## RebuildProjections (ops)

- **Actor / trigger:** the storefront operator, on an ops path; **never a
  user request**.
- **Inbound adapter:** an ops job or CLI (no REST route is modelled).
- **Preconditions:** the three topics exist and retain from the recorded
  offsets; the four snapshot routes are reachable.
- **Main flow:**
  1. Snapshot, paged: `ListCatalog` (`GET /catalog`, OHS) and
     `ListListings` (`GET /listings?nodeId=&catalogItemId=`, the
     ops-only in-org exception) from `offer-availability`;
     `ListItemPrices` (`GET /item-prices`) from `pricing`;
     `ListProductContents` (`GET /product-contents`) from
     `product-content`.
  2. Seed the projections and their guards from the snapshot (response
     shapes are not modelled — hotspot H7).
  3. Catch-up: consume the three topics from the recorded offsets; the
     guards skip whatever the snapshot already covers.
  4. Re-index the search rows in the same pass.
- **Errors:** whatever the snapshot routes return; the job retries a page,
  not the whole rebuild.
- **Idempotency:** the rebuild is inherently idempotent — same sources,
  same guards, same result.
- **Risk:** the `GET /listings` read is in-org; running it outside the
  ops path would break the storefront's OHS-only rule
  (`conventions.cross_model`). The overlap window between snapshot and
  events is safe only because every source carries a guard — which is why
  decision 4 and decision 5 are one design.
