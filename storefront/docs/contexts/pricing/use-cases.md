---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Pricing command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `pricing` service is built on develop ([`IQVO/pricing`](https://github.com/IQVO/pricing) at `5a18326`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/pricing#service-and-operations) section lists it.
:::

One section per command of `contexts[pricing].aggregates[*].commands`, plus
the two event-driven reactions (`WithdrawOnDiscontinue` and the
`CatalogItemView` projector) and the two clock-driven policies. They are
proposed application services in `internal/application/usecases`. The
step-by-step diagrams are on [Sequence Diagrams](/storefront/contexts/pricing/sequence-diagrams);
the payloads are on [Domain Events](/storefront/contexts/pricing/domain-events);
the REST contract is `storefront/apis/pricing/openapi.yaml`.

Reads are not use cases here: `GET /item-prices/{catalogItemId}`
(`GetItemPrice`), `GET /item-prices` (`ListItemPrices`, paged, bootstrap),
`GET /delivery-charge-schedules/current` (`GetCurrentChargeSchedule`),
`GET /tax-tables/current` (`GetCurrentTaxTable`) and
`GET /price-quotes/{quoteId}` (`GetPriceQuote`) read the stores directly.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `SetListPrice` | Merchandiser | REST `POST /item-prices`, `POST /item-prices/{catalogItemId}:set-list-price` | `ItemPriceChanged` |
| `ScheduleSale` | Merchandiser | REST `POST /item-prices/{catalogItemId}/sales` | `ItemPriceChanged` |
| `CancelSale` | Merchandiser | REST `POST /item-prices/{catalogItemId}/sales/{saleId}:cancel` | `ItemPriceChanged` |
| `WithdrawPrice` | Merchandiser | REST `POST /item-prices/{catalogItemId}:withdraw` | `ItemPriceWithdrawn` |
| `WithdrawPrice` (policy) | `WithdrawOnDiscontinue` | Kafka consumer, `CatalogItemDiscontinued` | `ItemPriceWithdrawn` |
| `PublishChargeSchedule` | Merchandiser | REST `POST /delivery-charge-schedules` | `DeliveryChargeScheduleChanged` |
| `PublishTaxTable` | Merchandiser | REST `POST /tax-tables` | `TaxTableChanged` |
| `IssuePriceQuote` | `checkout` | REST `POST /price-quotes` | `PriceQuoteIssued` (analytics) |
| `ExpireQuote` | Clock (`QuoteTtl`) | scheduler | none |
| Boundary publication | `PublishEffectivePriceOnWindowBoundary` | scheduler | `ItemPriceChanged` |
| Project `CatalogItemView` | `offer-availability` | Kafka consumer, `CatalogItemCreated`, `CatalogItemDiscontinued` | none |

## How save and publish commit

Every use case that changes an aggregate loads it with its `version`, calls
the aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`). If
an event is raised, the outbox row (`outbox_events`) is written in the same
transaction. A consumer-driven use case also inserts the CloudEvents `id`
into `processed_events` in that transaction. A relay publishes outbox rows
to Kafka after the commit.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` per `conventions.integration_rules`: not-found 404,
illegal-transition 409, concurrent-update 409, validation-failed 422.

## SetListPrice

- **Actor / trigger:** the storefront merchandiser.
- **Inbound adapter:** REST `POST /item-prices` (create) or
  `POST /item-prices/{catalogItemId}:set-list-price` (update), header
  `Idempotency-Key` required.
- **Input:** `catalogItemId`, `listPrice` (`amountMinor`, `currency`).
- **Preconditions:** the item exists in `CatalogItemView` and is not
  discontinued.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay the stored response on a hit.
  2. Load `ItemPrice` by `catalogItemId` (absent on first pricing).
  3. `ItemPrice.SetListPrice(...)`: checks `ErrUnknownCatalogItem` against
     `CatalogItemView`, `ErrNegativeAmount`, `ErrCurrencyMismatch`. On
     create the aggregate becomes `ACTIVE`; an active sale is untouched.
  4. In one transaction, save and write `ItemPriceChanged` to the outbox.
     Store the response under the key.
  5. Answer `201` (created) or `200` (updated) with the `version`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrUnknownCatalogItem` | 422 | `unknown-catalog-item` | Unknown or discontinued in `CatalogItemView`; the create may just be early (hotspot H6). |
| `ErrNegativeAmount` | 422 | `negative-amount` | |
| `ErrCurrencyMismatch` | 422 | `currency-mismatch` | Not the configured currency. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** `ItemPriceChanged` (`effectivePriceMinor` recomputed:
  an active sale still wins over the new list price).
- **Idempotency:** `Idempotency-Key`.

## ScheduleSale

- **Actor / trigger:** the merchandiser.
- **Inbound adapter:** REST `POST /item-prices/{catalogItemId}/sales`,
  header `Idempotency-Key` required.
- **Input:** `price` (`Money`), `from`, `to`.
- **Preconditions:** the item's price is `ACTIVE`.
- **Main flow:**
  1. `Idempotency-Key` lookup.
  2. Load `ItemPrice`; 404 `not-found` if never priced.
  3. `ItemPrice.ScheduleSale(...)`: `ErrSaleNotBelowList`,
     `ErrOverlappingSaleWindow`, `ErrNegativeAmount`,
     `ErrCurrencyMismatch`. A future window does not change the effective
     price yet; a window already open does.
  4. Save, outbox `ItemPriceChanged` when the effective price changed,
     store the key response, one transaction.
  5. Answer `201` with `saleId`.
- **Errors:**

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| price not found | 404 | `not-found` |
| `ErrSaleNotBelowList` | 422 | `sale-not-below-list` |
| `ErrOverlappingSaleWindow` | 422 | `overlapping-sale-window` |
| `ErrNegativeAmount` / `ErrCurrencyMismatch` | 422 | `negative-amount` / `currency-mismatch` |

- **Events emitted:** `ItemPriceChanged` if the effective price moved;
  otherwise none — the boundary policy publishes when the window opens.
- **Idempotency:** `Idempotency-Key`.

## CancelSale

- **Actor / trigger:** the merchandiser.
- **Inbound adapter:** REST
  `POST /item-prices/{catalogItemId}/sales/{saleId}:cancel`, header
  `Idempotency-Key` required.
- **Main flow:** load `ItemPrice` (404), remove the window
  (`saleId` unknown → 404 `not-found`), save, outbox `ItemPriceChanged`
  when the effective price moved (an active cancelled sale returns to
  list).
- **Errors:** 404 `not-found` for the price or the window; 409
  `illegal-transition` if the price is `WITHDRAWN`.
- **Events emitted:** `ItemPriceChanged` (this pack's reading: the model
  names no `SaleCancelled`; see the
  [canvas](/storefront/contexts/pricing/bounded-context-canvas) open questions).
- **Idempotency:** `Idempotency-Key`; cancelling a cancelled sale replays
  the stored response.

## WithdrawPrice (merchandiser)

- **Actor / trigger:** the merchandiser.
- **Inbound adapter:** REST `POST /item-prices/{catalogItemId}:withdraw` (merchandising UI, cmd channel).
- **Main flow:** load `ItemPrice`, `WithdrawPrice(...)`: `ACTIVE →
  WITHDRAWN`; already `WITHDRAWN` → 200 unchanged, no event. Save, outbox
  `ItemPriceWithdrawn`, one transaction.
- **Errors:** 404 `not-found`; 409 `illegal-transition` is not used —
  withdrawing twice is a no-op.
- **Events emitted:** `ItemPriceWithdrawn`.
- **Idempotency:** `Idempotency-Key`, and the no-op on `WITHDRAWN`.

## WithdrawPrice (policy WithdrawOnDiscontinue)

- **Actor / trigger:** `offer-availability` discontinued the item.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.offer-availability.events`, type
  `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued`.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`; a duplicate is acknowledged.
  2. Mark the item discontinued in `CatalogItemView`.
  3. Load `ItemPrice`; if none or already `WITHDRAWN`, stop (inbox row
     still written).
  4. `WithdrawPrice(...)`; save aggregate, view, outbox
     `ItemPriceWithdrawn` and inbox row in one transaction.
- **Errors:** none reach a caller; an aggregate error is logged as an
  anomaly and acknowledged.
- **Events emitted:** `ItemPriceWithdrawn`.
- **Idempotency:** inbox on the CloudEvents `id`.

## PublishChargeSchedule

- **Actor / trigger:** the merchandiser.
- **Inbound adapter:** REST `POST /delivery-charge-schedules`, header
  `Idempotency-Key` required.
- **Input:** `version`, `tiers[]` (`tier`, `chargeMinor`,
  `freeOverMinor?`).
- **Main flow:**
  1. `Idempotency-Key` lookup.
  2. `DeliveryChargeSchedule.PublishChargeSchedule(...)`:
     `ErrIncompleteChargeSchedule` (every one of the four tiers named),
     `ErrNonIncreasingVersion` against the current schedule.
  3. In one transaction: insert the new schedule `CURRENT`, move the
     previous `CURRENT → SUPERSEDED`, outbox
     `DeliveryChargeScheduleChanged`, store the key response.
  4. Answer `201` with `scheduleId` and `version`.
- **Errors:**

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIncompleteChargeSchedule` | 422 | `incomplete-charge-schedule` |
| `ErrNonIncreasingVersion` | 409 | `non-increasing-version` |

- **Events emitted:** `DeliveryChargeScheduleChanged`.
- **Idempotency:** `Idempotency-Key`; a replayed or lower version is
  `ErrNonIncreasingVersion`.

## PublishTaxTable

- **Actor / trigger:** the merchandiser.
- **Inbound adapter:** REST `POST /tax-tables`, header `Idempotency-Key`
  required.
- **Input:** `version`, `bands[]` (`postalPrefixFrom`, `postalPrefixTo`,
  `rateBasisPoints`).
- **Main flow:** as `PublishChargeSchedule`, with
  `ErrOverlappingTaxBand` and `ErrRateOutOfRange`; supersedes the current
  table and publishes `TaxTableChanged`.
- **Errors:**

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrOverlappingTaxBand` | 422 | `overlapping-tax-band` |
| `ErrRateOutOfRange` | 422 | `rate-out-of-range` |
| `ErrNonIncreasingVersion` | 409 | `non-increasing-version` |

- **Events emitted:** `TaxTableChanged`.
- **Idempotency:** `Idempotency-Key`.

## IssuePriceQuote

- **Actor / trigger:** `checkout`, when a checkout session opens
  (`OpenSession`).
- **Inbound adapter:** REST `POST /price-quotes`, header
  `Idempotency-Key` required.
- **Input:** `cartId`, the numbered lines (`catalogItemId`, `quantity`),
  the groups (`groupNo`, `offerId`, `tier`, `lineNos`) and the destination
  postal prefix (`destinationPostalPrefix`), as the model's inbound row lists
  them.
- **Preconditions:** every line's item has an `ACTIVE` price.
- **Main flow:**
  1. `Idempotency-Key` lookup.
  2. Price every line at the item's effective price (`ErrItemNotPriced`,
     `ErrEmptyQuote`, `ErrCurrencyMismatch`).
  3. Charge every group its selected tier from the current
     `DeliveryChargeSchedule` (with the free-over threshold).
  4. Apply the current `TaxTable` band of the destination postal prefix.
  5. `PriceQuote.IssuePriceQuote(...)`: status `ISSUED`, pinning the price
     versions, schedule version and tax-table version, `issuedAt` and
     `expiresAt` (`QuoteTtl`, default 15 minutes).
  6. Save, outbox `PriceQuoteIssued` (analytics topic), store the key
     response, one transaction.
  7. Answer `201` with `quoteId`, `totalMinor`, `expiresAt` and the pinned
     versions.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrItemNotPriced` | 422 | `item-not-priced` | The cart's `PurchasabilityView` should have caught it; a late withdrawal can still land here. |
| `ErrEmptyQuote` | 422 | `empty-quote` | |
| `ErrCurrencyMismatch` | 422 | `currency-mismatch` | A contract bug; alert. |

- **Events emitted:** `PriceQuoteIssued` (analytics only; `checkout` gets
  the quote in the reply).
- **Idempotency:** `Idempotency-Key`; `checkout` derives it from the
  session, so a retried open returns the same quote.

## ExpireQuote (clock)

- **Actor / trigger:** the clock; policy `QuoteTtl` (default 15 minutes).
- **Inbound adapter:** an internal scheduler scanning for `ISSUED` quotes
  past `expiresAt`.
- **Main flow:** `ExpireQuote(...)`: `ISSUED → EXPIRED`; save with the
  version check. Nothing is published, by decision; `checkout` learns of
  expiry from `expiresAt` and its own `ExpireOnQuoteExpiry` policy, and
  enforces `ErrPriceQuoteExpired` at confirm.
- **Idempotency:** expiring an `EXPIRED` quote is a no-op.

## Boundary publication (PublishEffectivePriceOnWindowBoundary)

- **Actor / trigger:** the clock, at a sale window's `from` or `to`.
- **Inbound adapter:** an internal scheduler.
- **Main flow:** find windows reaching a boundary; per item, recompute the
  effective price; when it moved, save nothing on the aggregate (the
  windows are already stored) and outbox `ItemPriceChanged`, idempotent per
  item and boundary — a re-run of the same boundary publishes nothing
  twice.
- **Events emitted:** `ItemPriceChanged`.

## Project CatalogItemView

- **Actor / trigger:** `offer-availability` catalogue events.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.offer-availability.events`, types
  `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated`
  and `...CatalogItemDiscontinued`.
- **Main flow:** inbox check; upsert the item's known/discontinued flag;
  inbox row, one transaction. On `CatalogItemDiscontinued` the same
  consumer hands off to `WithdrawOnDiscontinue` (above).
- **Events emitted:** none.
- **Idempotency:** inbox on the CloudEvents `id`; create and discontinue
  share the `catalogItemId` key upstream, so per-item order holds.
