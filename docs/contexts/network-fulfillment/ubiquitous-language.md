---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: NetworkOrder, NetworkRef, NetworkLineRef, NetworkProductId vs. SKU, LocalOrderId, requiredShipBy, acknowledgeBy, held order — pulled from the domain code and .claude/rules/domain-model.md, plus the planned CapabilityOffer.
---

# Ubiquitous Language

The definitions below come from the source repository's own domain code
(`internal/domain/networkorder/network_order.go`,
`internal/domain/shared/shared.go`) and its
`.claude/rules/domain-model.md`, which is kept in sync with the code and
forbids describing planned concepts as if they exist. Planned terms are
labelled as such.

| Term | Definition |
| --- | --- |
| **NetworkOrder** | Demand that arrived from the external network carrying a deadline we did not choose; answered exactly once, in full or not at all. The aggregate owns the network *protocol* — the answer, its deadline and the mapping to local work — and none of the fulfillment (no allocation, promise computation or release). |
| **NetworkRef** | The network's own identity for a unit of demand (for Vendor Direct Fulfillment, its purchase-order number). An **opaque** string: this context is Conformist upstream, so it never parses or derives meaning from it. Also the Postgres primary key, because the network addresses every answer by it. |
| **NetworkLineRef** | The network's identity for one line *within* a NetworkRef — unique only inside its order, hence a distinct type. |
| **NetworkProductId** | The network's product identifier (an ASIN, in Amazon's vocabulary). It is **not** a SKU; keeping the two as separate types makes a missing translation a compile error rather than a silently wrong lookup. Retained on each line alongside the SKU, because answers go back to the network in its terms. |
| **SKU** | *Our* product identity, the vocabulary every other context speaks. Appears here only as the **output** of the Anti-Corruption Layer's translation. |
| **Product translation** | The ACL's dictionary, `networkProductId -> SKU`, loaded from `PRODUCT_TRANSLATION_FILE`. Without it every order is rejected as untranslatable (and the service logs a warning at startup saying so). |
| **LocalOrderId** | `order-management`'s `OrderId` for the held order raised from a NetworkOrder. A **persisted one-to-one mapping**, never a string convention — the fleet was burned once by an identifier that looked like an order reference and was not (order-management ADR 0018). Linkable only once acknowledged, and only once. |
| **SiteId** | The fulfillment site a NetworkOrder is destined for — the same identity `order-management`'s `PromisePolicy` and `process-path-management`'s CPT schedule key on. |
| **requiredShipBy** | The network's deadline, sent to `order-management` as-is. `order-management` decides feasibility; this context never does. |
| **acknowledgeBy** | `receivedAt + AcknowledgementWindow`. The window is **24h, a domain constant** (a fact about the counterparty's protocol, not a knob), fixed at receipt and persisted, never recomputed — so a batch polled after an outage keeps its real deadlines. |
| **Held order** | An `order-management` order raised with `releaseOnAllocation: false` (its ADR 0020): allocated but not released. Released on acknowledgement, cancelled on rejection. |
| **State (NEW / ACKNOWLEDGED / REJECTED / CONFIRMED)** | The NetworkOrder lifecycle: `NEW -> ACKNOWLEDGED -> CONFIRMED`, `NEW -> REJECTED`. `CONFIRMED` (shipment confirmed to the network) exists in the domain but **no use case reaches it yet**. |
| **Acknowledgement overdue** | Still `NEW` and past `acknowledgeBy` — the predicate the deadline sweep acts on. A reported fact about a missed SLA, not an error. |
| **NETWORK_MODE (stub / sandbox / live)** | The switch every call to the network goes through, default `stub` (unrecognised values are also `stub`). Only `stub` is implemented; `sandbox`/`live` refuse to boot. |
| **CapabilityOffer** *(planned)* | Advertised quantity per `(sku, siteId)` with a `basis` of `Physical` or `ThroughputConstrained`, invariant `advertisedQuantity <= physicalAvailable`. Designed in [ADR 0001](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md); **not in the code**. |

## Network vocabulary that must never cross inward

`purchaseOrderNumber`, `itemSequenceNumber`, `buyerProductIdentifier`,
`acknowledgementStatus` codes, `sellingParty`/`shipFromParty` and
`ShippingSpeedCategory` belong to the network. They may appear only
inside `internal/adapters/outbound/network/` and never in
`internal/domain` or anything published to the fleet. `arch-go` cannot
catch a *vocabulary* leak — that check is human.

See [Ubiquitous Language](/strategic-design/ubiquitous-language) at the
platform level for terms reused across contexts with different meanings.
