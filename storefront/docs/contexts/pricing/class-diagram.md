---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: UML class diagrams of Pricing's domain model, events and policies, and the hexagonal ports-and-adapters layout, as the model designs them, with the as-built Go packages.
---

# Class Diagram

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `pricing` service is built on develop ([`IQVO/pricing`](https://github.com/IQVO/pricing) at `5a18326`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/pricing#service-and-operations) section lists it.
:::

UML class diagrams of the `internal/domain/**` packages as the model designs them, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`itemprice.ItemPrice`, `schedule.TierCharge`, `tax.TaxBand`,
`quote.PriceQuote`) and value objects. Fields are unexported in Go and shown
with `-`; methods are shown with `+`.

**As built** (`IQVO/pricing` develop `5a18326`): the domain packages are `internal/domain/itemprice`, `internal/domain/quote`, `internal/domain/schedule`, `internal/domain/tax`. Exported types per package: `itemprice`: `ItemPriceChanged`, `ItemPriceWithdrawn`, `ID`, `State`, `CatalogState`, `Inputs`, `SaleWindow`, `View`, `ItemPrice`, `Snapshot`; `quote`: `ID`, `State`, `LineInput`, `GroupInput`, `IssueInput`, `Line`, `Group`, `PriceQuote`, `PriceQuoteIssued`, `Snapshot`; `schedule`: `ID`, `State`, `TierCharge`, `DeliveryChargeSchedule`, `Snapshot`, `DeliveryChargeScheduleChanged`; `tax`: `ID`, `State`, `TaxBand`, `TaxTable`, `Snapshot`, `TaxTableChanged`. Application packages: `internal/application/idempotency`, `internal/application/outbox`, `internal/application/ports`, `internal/application/usecases`, `internal/application/views`; adapters: `internal/adapters/inbound/http`, `internal/adapters/inbound/kafka`, `internal/adapters/inbound/requestlog`, `internal/adapters/outbound/clock`, `internal/adapters/outbound/ids`, `internal/adapters/outbound/kafka`, `internal/adapters/outbound/memory`, `internal/adapters/outbound/outbox`, `internal/adapters/outbound/postgres`, `internal/adapters/outbound/repocontract`, `internal/adapters/outbound/telemetry`. Where a type name below differs (the UML keeps the design names), the [Ubiquitous Language](/storefront/contexts/pricing/ubiquitous-language) page carries the built identifier.

## 1. ItemPrice aggregate

```mermaid
classDiagram
    direction TB
    class ItemPrice {
        <<AggregateRoot>>
        -catalogItemId string
        -listPrice Money
        -sales SaleWindow[]
        -status ItemPriceStatus
        -version int
        +SetListPrice(price Money, at time.Time)$ ItemPrice
        +ScheduleSale(price Money, from, to time.Time) saleId
        +CancelSale(saleId string) error
        +WithdrawPrice(at time.Time) error
        +EffectivePrice(at time.Time) Money
    }
    class ItemPriceStatus {
        <<Enumeration>>
        ACTIVE
        WITHDRAWN
    }
    class Money {
        <<ValueObject>>
        -amountMinor int64
        -currency string
    }
    class SaleWindow {
        <<ValueObject>>
        -saleId string
        -price Money
        -from time.Time
        -to time.Time
    }
    class ItemPriceRepository {
        <<Repository>>
        +Get(ctx, catalogItemId) ItemPrice
        +Insert(ctx, p) error
        +Update(ctx, p, expectedVersion) error
    }
    ItemPrice --> ItemPriceStatus : status
    ItemPrice *-- "1" Money : listPrice
    ItemPrice *-- "0..*" SaleWindow : sales
    SaleWindow *-- "1" Money : price
    ItemPriceRepository ..> ItemPrice : persists
```

Derived from: `model.yaml → contexts[pricing].aggregates[ItemPrice]`
(`states`, `value_objects`, `commands`, `invariants`).

Omitted: read accessors and the `Err...` variables (`ErrNegativeAmount`,
`ErrCurrencyMismatch`, `ErrSaleNotBelowList`, `ErrOverlappingSaleWindow`,
`ErrUnknownCatalogItem`; listed on the
[Aggregate Design Canvas](/storefront/contexts/pricing/aggregate-design-canvas)).
`EffectivePrice` is derived, never stored: the lowest active sale price,
else the list price.

## 2. DeliveryChargeSchedule and TaxTable aggregates

```mermaid
classDiagram
    direction TB
    class DeliveryChargeSchedule {
        <<AggregateRoot>>
        -scheduleId string
        -version int
        -tiers TierCharge[]
        -status ScheduleStatus
        +PublishChargeSchedule(version, tiers)$ DeliveryChargeSchedule
    }
    class ScheduleStatus {
        <<Enumeration>>
        CURRENT
        SUPERSEDED
    }
    class TierCharge {
        <<ValueObject>>
        -tier Tier
        -charge Money
        -freeOver Money nullable
    }
    class Tier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    class TaxTable {
        <<AggregateRoot>>
        -taxTableId string
        -version int
        -bands TaxBand[]
        -status ScheduleStatus
        +PublishTaxTable(version, bands)$ TaxTable
    }
    class TaxBand {
        <<ValueObject>>
        -postalPrefixFrom string
        -postalPrefixTo string
        -rateBasisPoints int
    }
    DeliveryChargeSchedule --> ScheduleStatus
    DeliveryChargeSchedule *-- "4" TierCharge : tiers
    TierCharge --> Tier
    TaxTable --> ScheduleStatus
    TaxTable *-- "1..*" TaxBand : bands
```

Derived from: `model.yaml → contexts[pricing].aggregates[DeliveryChargeSchedule]`,
`.aggregates[TaxTable]`; `conventions.integration_rules` (money shape).

Omitted: the two repositories (same shape as `ItemPriceRepository`) and the
`Err...` variables (`ErrIncompleteChargeSchedule`,
`ErrNonIncreasingVersion`, `ErrOverlappingTaxBand`, `ErrRateOutOfRange`).
`Tier` is the network's delivery-promise vocabulary, re-declared locally:
there is no shared kernel. Both aggregates share `ScheduleStatus`
(`CURRENT`/`SUPERSEDED`): publishing a new version supersedes the
previous one in the same transaction.

## 3. PriceQuote aggregate, events and policies

```mermaid
classDiagram
    direction TB
    class PriceQuote {
        <<AggregateRoot>>
        -quoteId string
        -cartId string
        -lines QuoteLine[]
        -groups QuoteGroup[]
        -taxMinor int64
        -totalMinor int64
        -priceVersions map
        -scheduleVersion int
        -taxTableVersion int
        -issuedAt time.Time
        -expiresAt time.Time
        -status QuoteStatus
        +IssuePriceQuote(cartId, lines, groups, at)$ PriceQuote
        +ExpireQuote(at time.Time) error
    }
    class QuoteStatus {
        <<Enumeration>>
        ISSUED
        EXPIRED
    }
    class QuoteLine {
        <<ValueObject>>
        -catalogItemId string
        -quantity int
        -unitPrice Money
        -lineTotal Money
    }
    class QuoteGroup {
        <<ValueObject>>
        -groupNo int
        -tier Tier
        -deliveryCharge Money
    }
    PriceQuote --> QuoteStatus
    PriceQuote *-- "1..*" QuoteLine : lines
    PriceQuote *-- "0..*" QuoteGroup : groups
```

```mermaid
classDiagram
    direction TB
    class ItemPriceChanged {
        <<DomainEvent>>
        +catalogItemId string
        +currency string
        +listPriceMinor int64
        +effectivePriceMinor int64
        +saleEndsAt time.Time nullable
        +version int
    }
    class ItemPriceWithdrawn {
        <<DomainEvent>>
        +catalogItemId string
        +version int
    }
    class DeliveryChargeScheduleChanged {
        <<DomainEvent>>
        +scheduleId string
        +version int
        +tiers TierCharge[]
    }
    class TaxTableChanged {
        <<DomainEvent>>
        +taxTableId string
        +version int
        +bands TaxBand[]
    }
    class PriceQuoteIssued {
        <<DomainEvent>>
        +quoteId string
        +cartId string
        +currency string
        +totalMinor int64
        +expiresAt time.Time
    }
```

```mermaid
classDiagram
    direction TB
    class PublishEffectivePriceOnWindowBoundary {
        <<Policy>>
        sale starts or ends
        emit ItemPriceChanged
        idempotent per item and boundary
    }
    class WithdrawOnDiscontinue {
        <<Policy>>
        on CatalogItemDiscontinued
        withdraw the item price
    }
    class QuoteTtl {
        <<Policy>>
        expires 15 min after issue
        by time, immutable otherwise
    }
    class ItemPriceChanged {
        <<DomainEvent>>
    }
    class ItemPriceWithdrawn {
        <<DomainEvent>>
    }
    class PriceQuoteIssued {
        <<DomainEvent>>
    }
    PublishEffectivePriceOnWindowBoundary ..> ItemPriceChanged : leads to
    WithdrawOnDiscontinue ..> ItemPriceWithdrawn : leads to
    QuoteTtl ..> PriceQuoteIssued : none after expiry (no event)
```

Derived from: `model.yaml → contexts[pricing].aggregates[PriceQuote]`,
`.publishes`, `.policies`.

Omitted: the CloudEvents envelope (built in the Kafka adapter). The
`QuoteTtl` edge is drawn to `PriceQuoteIssued` only to show the asymmetry:
issue publishes, expiry does not, by decision: expiry is checkout-internal
TTL state (see [EventStorming](/storefront/contexts/pricing/eventstorming)).

## 4. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>merchandiser writes and reads,<br/>checkout quote routes,<br/>paged bootstrap read"]
        KC["kafka<br/>consumer: offer-availability"]
        SCH["scheduler<br/>sale boundaries, quote expiry"]
    end
    APP["<b>internal/application/usecases</b><br/>SetListPrice, ScheduleSale, CancelSale<br/>WithdrawPrice, PublishChargeSchedule<br/>PublishTaxTable, IssuePriceQuote<br/>ExpireQuote, PublishOnWindowBoundary<br/>ProjectCatalogItemView"]
    DOM["<b>internal/domain</b><br/>itemprice.ItemPrice<br/>schedule.DeliveryChargeSchedule<br/>tax.TaxTable<br/>quote.PriceQuote"]
    PORTS["<b>internal/application/ports</b><br/>ItemPriceRepository<br/>ChargeScheduleRepository<br/>TaxTableRepository<br/>PriceQuoteRepository<br/>CatalogItemStore<br/>Outbox, Inbox<br/>IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repositories, outbox, inbox,<br/>catalog-item store,<br/>idempotency store, UoW"]
        A2["kafka<br/>outbox relay"]
    end
    HTTP --> APP
    KC --> APP
    SCH --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    A1 -. outbox rows .-> A2
```

Derived from: `model.yaml → contexts[pricing].aggregates`, `.inbound`,
`.read_models`, `.policies`; `conventions.integration_rules` (outbox,
inbox); the fleet's Go hexagonal layout. `sync_calls` is empty, so there is
**no outbound REST client** in this context.

Omitted: the composition root (`cmd/pricing`), metrics and tracing. The
scheduler is an inbound adapter: time triggers
`PublishEffectivePriceOnWindowBoundary` and `ExpireQuote`. The read routes
(`GetItemPrice`, `ListItemPrices`, `GetCurrentChargeSchedule`,
`GetCurrentTaxTable`, `GetPriceQuote`) read the stores through their ports
without a use case.
