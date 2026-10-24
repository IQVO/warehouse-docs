---
id: fleet-changes
title: What the fleet must change
sidebar_label: Fleet changes
description: "The concrete changes the warehouse-systems fleet needs to plug into retail-network, each with the evidence from origin/develop, and the fleet contexts that need no change at all."
---

# What the fleet must change

:::info[Fact and model]
"Today" columns are read from `origin/develop` on 2026-10-22, with the path.
"Needed" columns are what this model requires. This page proposes; it does
not change any fleet repository. Each row would be a feature branch and PR in
the owning repository, under that repository's own ADR.
:::

## network-fulfillment (the only fleet context with real work)

| # | Today | Needed | Why |
| --- | --- | --- | --- |
| 1 | The gateway is a stub: `internal/adapters/outbound/network/gateway.go` and `seed.go` (`NETWORK_SEED_FILE`). | A live adapter in `internal/adapters/outbound/retailnetwork/` (the rename ADR 0009 §2 already decided), behind the same `NetworkGateway` port, selected by `NETWORK_MODE=live`. | There is nothing to call yet; the Vendor API on this site is that something. |
| 2 | `DeclareCapability` is "a documented no-op", because "the network's real API has no such operation" (`internal/application/ports/ports.go`). | `PUT /vendor/nodes/{nodeId}/profile` from the site's `CPTScheduleChanged` cutoffs, eligible-path `cycleTimeP95` and `PathCapacityChanged`. A new ADR amends the port comment. | The network accepts a declared profile ([ADR 0003](/network/adr/0003-declared-and-measured-capability)); the real vendor platform API also has one for sellers (supply-source API, see public seller-API documentation). |
| 3 | No node registration; sites are identified by `SiteId` only. | `POST /vendor/nodes` per site whose `siteRole` maps to a vendor node type ([Node model](/network/network-model/node-model)), and a persisted `siteCode ↔ nodeId` table. | The network keys everything by `nodeId`; the mapping must be data, never a string rule. |
| 4 | `SubmitAvailability(update)` per SKU and site; SKUs translated by a file dictionary (`docs/adr/0013-product-translation-file-acl-dictionary.md`). | `POST /vendor/inventory` per node with `listingId`, `availableQty` and `basis`; `isFullUpdate=true` on the periodic recompute. The dictionary gains `listingId`. | Listings are (catalogue item, node) in the network. |
| 5 | `SubmissionStatus(ref)` reconciles by `NetworkRef`. | Persist the `transactionId` returned by every 202 and reconcile by it. | Every Vendor API write is its own transaction. |
| 6 | The acknowledgement deadline is held locally (`acknowledgeBy`, `ListOpenHolds` doc comment). | Take `ackBy` from the purchase order. | The network computes `ackBy = min(issuedAt + ackWindow, requiredShipBy - handlingTime)`; a late-evening order has far less than 24 hours. |
| 7 | Rejections carry `INFEASIBLE_DEADLINE`, `UNTRANSLATABLE_SKU`, `ACKNOWLEDGEMENT_DEADLINE_MISSED`, `SUBMISSION_FAILED` (`internal/adapters/outbound/kafka/testdata/wire/events/`). | Map them to `CANNOT_MEET_SHIP_BY`, `UNKNOWN_LISTING` and the expiry the network records; `SUBMISSION_FAILED` stays internal. | The network's reason codes are its Published Language. |
| 8 | Shipment confirmation is an explicit endpoint, not a `PackageManifested` correlation (`docs/adr/0014-explicit-shipment-confirmation-endpoint.md`). | An order-level "all packages manifested" fact from `order-management` (proposed earlier in the fleet as `OrderManifested`; **not present** on `origin/develop`), then label + confirmation automatically. | Without it a human or a test has to call the confirmation endpoint. |

## Other fleet contexts

| Context | Change | Evidence |
| --- | --- | --- |
| `order-management` | Row 8 above (optional for v1). Nothing else: held orders, `releaseOnAllocation=false` and `FeasibleBy` already exist. | `internal/domain/order/promise_policy.go`, `internal/adapters/inbound/http/dto.go` |
| `process-path-management` | none: `CPTScheduleChanged` and `cycleTimeP95` are already the source of the declared profile | `network-fulfillment` port `ProcessPathCapability` |
| `wes-work-planning` | none: `PathCapacityChanged` is already consumed | port `PathCapacity` |
| `inventory-storage` | none: usable stock is already read | port `InventoryAvailability` |
| `fulfillment-execution` | none | |
| `facility-layout` | none: `siteRole` already decides the node type | ADR 0037 |
| `warehouse-infra` | later, when network contexts are built: their own deployments; `NETWORK_MODE=live` and `NETWORK_BASE_URL` for `network-fulfillment` in the same change | |
| `warehouse-docs` | the fleet context map gains the network as the upstream of `network-fulfillment`, linking here | |

## Order of work (when it starts)

1. This site's Vendor API contract is reviewed and frozen (`apis/vendor-connectivity/openapi.yaml`).
2. `vendor-connectivity`, `node-topology` and `offer-availability` are built first (the vendor can register, declare and feed).
3. `network-fulfillment` rows 1-7 land against them in `NETWORK_MODE=live`.
4. `order-sourcing`, `delivery-promise`, `linehaul-transportation`, `last-mile-delivery`, `shipping-and-tracking` and `node-performance` follow; `customer-ordering` last.
5. Row 8 when the fleet wants shipment confirmation without a manual call.

## Seller inbound (proposed, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments))

The "Today" column is omitted here on purpose. The fleet's own handling of
case-packed receiving is designed in the fleet's repositories, not in this
one, and this page makes no claim about its current state. What the network
side needs from `network-fulfillment`, and nothing else, is:

| # | Needed | Why |
| --- | --- | --- |
| 9 | Poll `GET /vendor/inbound-shipments` for the vendor's nodes and translate the carton tree into the fleet's own advance shipment notice, with the seller's `ownerRef` carried as an opaque tag. | The manifest reaches the fleet only through the Vendor API. |
| 10 | When a shipment is received, submit `POST /vendor/inbound-receipts` with per-SSCC status and eaches per GTIN, keeping the `transactionId`. | `seller-inbound` closes the shipment from this receipt. |
| 11 | Translate catalogue packaging (levels, GTINs, `unitsPerPack`) into the fleet's own item master through the fleet's own interfaces. | The packaging hierarchy is the catalogue's fact. |

No new Kafka topic is needed in either direction, and no fleet context other
than `network-fulfillment` is touched by the network's design.
