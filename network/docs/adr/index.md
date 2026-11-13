---
id: index
slug: /adr
title: Architecture Decision Records
sidebar_label: Index
sidebar_position: 1
description: "The domain-level decisions behind the retail-network model, and the index of every context repository's own ADRs."
---

# Architecture Decision Records

## Domain ADRs

All nine are **Proposed** (the status in each ADR body). All eleven context
repositories exist and are built on `develop`: 0001 to 0008 are realized by
the ten contexts other than `seller-inbound`, and 0009 by `seller-inbound`, whose ADR 0001 takes this model
as its design source. Each repository carries its own ADR sequence on top of
these domain-level decisions (below). An ADR becomes Accepted when the user
accepts it.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](/network/adr/0001-retail-network-domain-of-ten-contexts) | The retail network is its own domain of ten bounded contexts | Proposed |
| [0002](/network/adr/0002-promise-and-assignment-are-separate) | Promise and order assignment are separate contexts | Proposed |
| [0003](/network/adr/0003-declared-and-measured-capability) | Capability is declared and measured | Proposed |
| [0004](/network/adr/0004-parcel-nodes-are-network-operated) | Parcel nodes are network-operated | Proposed |
| [0005](/network/adr/0005-vendor-acceptance-is-the-path-lock) | The vendor node's acceptance is the path lock | Proposed |
| [0006](/network/adr/0006-pii-confinement) | PII is confined to customer-ordering and shipping-and-tracking | Proposed |
| [0007](/network/adr/0007-cloudevents-namespace) | CloudEvents namespace com.retailnetwork, no shared topic | Proposed |
| [0008](/network/adr/0008-capacity-held-at-promise-time) | Fast tiers are never promised from nominal times, and capacity is held at promise time | Proposed |
| [0009](/network/adr/0009-seller-inbound-and-case-packed-shipments) | Seller inbound and case-packed shipments: SSCC cartons, owner-segregated stock, eaches as the ledger unit | Proposed |
| [0010](./0010-carrier-handoff-delivery.md) | Carrier handoff delivery for low-density service areas (amends 0004) | Accepted |
| [0011](./0011-pickup-points.md) | Pickup points and lockers (extends 0004) | Accepted |

## Service ADRs (one sequence per context repository)

Each of the eleven context repositories records its own decisions on top of
the domain-level ones above: 166 ADRs on `develop` as of 2026-11-12. They are
linked, never copied; the *Status* column is the word from each ADR's own
status line. Since the fleet observability standard (accepted 2026-10-26),
every repository added an A2A inbound adapter and adopted the fleet REST API
guideline, and six (`node-topology`, `offer-availability`, `delivery-promise`,
`customer-ordering`, `vendor-connectivity`, `seller-inbound`) also record
agent authority levels and the complete MCP surface (2026-11-02). The
network evolution wave 0 (2026-11-08/09) added the owner-aware sourcing and
promise ADRs (gap G47), seller status and received stock as integration facts
(G48, G51), fulfillment centres receiving inbound (G64), batch delivery
estimates (G60) and the analytics read sides of four contexts. Wave 1
(2026-11-09) added the fast-tier eligibility decision of `node-performance`
and the four promise-quality ADRs of `delivery-promise`: calibrated quotes
with a confidence, a sweep that flags promises whose load is running late, a
fast-tier candidate filter on node eligibility, and a capacity band on offers. Wave 2 (2026-11-09/10) added the versioned
sourcing policy of `order-sourcing` (cross-region surcharge and a regional budget,
refining gap G26), cross-order consolidation (a consolidation key in
`customer-ordering`, carrier and follower merge at release in `order-sourcing`, the
purchase-order cancel of `vendor-connectivity`, the follower lock of
`linehaul-transportation`, and one tracking number shared by several assignments or
groups in `delivery-promise` and `customer-ordering`) and the opt-in `CONSOLIDATED`
tier with a customer-chosen delivery day (`delivery-promise`, `customer-ordering`,
`order-sourcing`). Wave 3 (2026-11-11/12) added the day-of stop ETA window of
`last-mile-delivery` and its relay onto the journey (`shipping-and-tracking`)
and the tracking view (`customer-ordering`), and the delivery-point profile
with its flag, relay and shopper advisory across the same three contexts.
`linehaul-transportation` ADR 0013 (a direct-lane advisory) is
Proposed on a feature branch only and not on `develop`, so the sequence there
jumps from 0012 to 0014.


### node-topology

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0001-node-topology-bounded-context.md) | Node Topology is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The Node, Lane, ServiceArea and Region aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0003-no-consumed-contracts-and-ohs-reads.md) | No consumed contracts, Open Host Service reads, outbox publishing and versioned profile revisions | Accepted |
| [0004](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0005-outbox-relay-and-attempt-cap.md) | The outbox relay, its attempt cap and the CloudEvents encoders | Accepted |
| [0006](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0006-http-adapter-idempotency-and-readiness.md) | The HTTP adapter, Idempotency-Key, problem types and readiness | Accepted |
| [0007](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0007-inbound-limits-on-the-operational-profile.md) | Inbound limits on the operational profile | Accepted |
| [0008](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0008-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0009](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0009-console-remote.md) | A web console remote | Accepted |
| [0010](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0010-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0011](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0011-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0012](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0012-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0013](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0013-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0014](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0014-lane-cost-declaration.md) | Lane cost declaration (cents, planner-declared) | Accepted |
| [0015](https://github.com/IQVO/node-topology/blob/develop/docs/adr/0015-fulfillment-centres-receive-inbound.md) | Fulfillment centres receive inbound | Accepted |

### offer-availability

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0001-offer-availability-bounded-context.md) | Offer & Availability is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The CatalogItem, Listing and InventoryFeed aggregates, the NodeStatusView, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0003-consumed-contracts-and-local-node-status.md) | Consumed contracts, the local node status read model and the relationships of offer-availability | Accepted |
| [0004](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0005-runtime-relay-consumer-and-idempotency.md) | Runtime: outbox relay cap, consumer dead letters, retention janitor and the FAILED feed | Accepted |
| [0006](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0006-catalog-gtin-packaging-and-listing-owner.md) | Catalogue GTIN and packaging hierarchy, and the optional owner of a listing | Accepted |
| [0007](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0007-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0008](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0008-console-remote.md) | The console remote (offer_availability_mfe) — read-only screens over the existing REST | Accepted |
| [0009](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0009-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0010](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0010-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0011](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0011-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0012](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0012-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0013](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0013-seller-status-and-received-stock-drive-owner-listings.md) | Seller status and received stock drive owner listings | Accepted |
| [0014](https://github.com/IQVO/offer-availability/blob/develop/docs/adr/0014-received-stock-creates-owner-listings.md) | Received stock creates owner listings | Accepted |

### delivery-promise

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0001-delivery-promise-bounded-context.md) | Delivery Promise is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | Aggregates, invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models and relationships | Accepted |
| [0004](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0005-outbox-relay-and-attempt-cap.md) | The outbox relay, its attempt cap and the CloudEvents encoder | Accepted |
| [0006](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0006-http-adapter-consumer-and-readiness.md) | The HTTP adapter, the consumer, the sweeper and readiness | Accepted |
| [0007](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0007-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0008](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0008-console-remote.md) | A warehouse-console web remote | Accepted |
| [0009](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0009-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0010](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0010-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0011](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0011-the-delivery-window-names-its-local-time-zone.md) | The delivery window names its local time zone | Accepted |
| [0012](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0012-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0013](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0013-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0014](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0014-measured-transit-basis.md) | Measured-transit promising (basis MEASURED) | Accepted |
| [0015](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0015-confirmed-units-stay-decremented.md) | Confirmed units stay decremented until the feed that accounts for them lands | Accepted |
| [0016](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0016-book-charge-follows-the-locked-node.md) | The PromiseBook charge follows the node order-sourcing locks | Accepted |
| [0017](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0017-owner-aware-availability-and-promise-netting.md) | Owner-aware availability and promise netting | Accepted |
| [0018](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0018-analytics-read-side.md) | Analytics read side | Accepted |
| [0019](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0019-batch-delivery-estimates-for-listing-pages.md) | Batch delivery estimates for listing pages | Accepted |
| [0020](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0020-promise-calibration-from-the-services-own-judgement.md) | Promise calibration from the service's own judgement | Accepted |
| [0021](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0021-a-sweep-flags-promises-whose-locked-path-is-running-late.md) | A sweep flags promises whose locked path is running late | Accepted |
| [0022](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0022-fast-tier-candidates-are-filtered-on-node-eligibility.md) | Fast-tier candidates are filtered on node eligibility | Accepted |
| [0023](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0023-offers-carry-a-capacity-band.md) | Offers carry a capacity band | Accepted |
| [0024](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0024-an-opt-in-consolidated-tier-with-a-customer-chosen-delivery-day.md) | An opt-in CONSOLIDATED tier with a customer-chosen delivery day | Accepted |
| [0025](https://github.com/IQVO/delivery-promise/blob/develop/docs/adr/0025-a-tracking-number-may-belong-to-several-assignments.md) | A tracking number may belong to several assignments | Accepted |

### customer-ordering

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0001-customer-ordering-bounded-context.md) | Customer Ordering is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The CustomerOrder and Shopper aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models and relationships | Accepted |
| [0004](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0005-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0006](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0006-console-remote.md) | The console remote (customer_ordering_mfe) — a read-only screen over the existing REST | Accepted |
| [0007](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0007-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0008](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0008-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0009](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0009-delivery-window-time-zone.md) | The delivery window carries its local time zone | Accepted |
| [0010](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0011-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0012](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0012-consolidation-key-and-shared-tracking-numbers.md) | The consolidation key and shared tracking numbers | Accepted |
| [0013](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0013-consolidated-tier-and-chosen-delivery-day.md) | The CONSOLIDATED tier and the stored chosen delivery day | Accepted |
| [0014](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0014-day-of-eta-window-on-the-tracking-view.md) | The day-of ETA window on the tracking view | Accepted |
| [0015](https://github.com/IQVO/customer-ordering/blob/develop/docs/adr/0015-delivery-point-advisory-on-the-tracking-view.md) | The delivery-point advisory on the tracking view | Accepted |

### order-sourcing

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0001-order-sourcing-bounded-context.md) | Order Sourcing is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0002-aggregates-invariants-and-assumptions.md) | The FulfillmentAssignment aggregate, its invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models and relationships | Accepted |
| [0004](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0005-outbox-relay-attempt-cap-sweep-and-shutdown.md) | Outbox relay, attempt cap, queue sweep and shutdown order | Accepted |
| [0006](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0006-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0007](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0007-console-remote.md) | A web console remote | Accepted |
| [0008](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0008-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0009](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0009-a2a-inbound-adapter.md) | An A2A inbound adapter (read-only) | Accepted |
| [0010](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0011-money-denominated-assignment-cost.md) | The money-denominated AssignmentCost | Accepted |
| [0012](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0012-owner-aware-availability-and-sourcing.md) | Owner-aware availability and sourcing | Accepted |
| [0013](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0013-analytics-read-side-and-the-sourcing-decision-fact.md) | Analytics read side and the sourcing-decision fact | Accepted |
| [0014](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0014-a-versioned-sourcing-policy.md) | A versioned sourcing policy | Accepted |
| [0015](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0015-carrier-and-follower-consolidation-at-release.md) | Carrier and follower consolidation at release | Accepted |
| [0016](https://github.com/IQVO/order-sourcing/blob/develop/docs/adr/0016-consolidated-delivery-day-search-and-latest-pickup-hold.md) | The CONSOLIDATED delivery day, search window and latest-pickup hold | Accepted |

### vendor-connectivity

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0001-vendor-connectivity-bounded-context.md) | Vendor Connectivity is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The VendorAccount, PurchaseOrder and Submission aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models, synchronous calls and relationships | Accepted |
| [0004](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0005-inbound-shipments-receipts-and-catalog-packaging.md) | Inbound shipments, inbound receipts and catalogue packaging | Accepted |
| [0006](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0006-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0007](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0007-console-remote.md) | A warehouse-console remote (web MFE) | Accepted |
| [0008](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0008-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0009](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0009-a2a-inbound-adapter.md) | An A2A inbound adapter (a read-only third driving adapter) | Accepted |
| [0010](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0011-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0012](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0012-purchase-order-lines-name-the-stock-owner.md) | Purchase-order lines name the stock owner | Accepted |
| [0013](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0013-cancel-the-purchase-order-when-a-release-is-withdrawn.md) | Cancel the purchase order when a release is withdrawn | Accepted |

### linehaul-transportation

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0001-linehaul-transportation-bounded-context.md) | Linehaul Transportation is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The Departure, LaneSchedule and Load aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models and relationships | Accepted |
| [0004](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0005-outbox-relay-and-attempt-cap.md) | The outbox relay, its attempt cap and the CloudEvents encoder | Accepted |
| [0006](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0006-http-adapter-idempotency-and-readiness.md) | The HTTP adapter, Idempotency-Key, problem types and readiness | Accepted |
| [0007](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0007-kafka-consumers-inbox-and-dead-letters.md) | The Kafka consumers, the inbox and the dead letters | Accepted |
| [0008](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0008-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0009](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0009-console-remote.md) | The console remote (linehaul_mfe) — a read-only screen over the existing REST | Accepted |
| [0010](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0010-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0011](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0011-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0012](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0012-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0014](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0014-consolidated-follower-lock-books-nothing.md) | A follower lock books nothing | Accepted |

### last-mile-delivery

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0001-last-mile-delivery-bounded-context.md) | Last-Mile Delivery is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The DeliveryWave, Route, DeliveryServicePartner and PackageAttemptHistory aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models and relationships | Accepted |
| [0004](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0005-runtime-outbox-http-and-readiness.md) | Runtime, outbox, HTTP and readiness | Accepted |
| [0006](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0006-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0007](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0007-console-remote.md) | A console web remote | Accepted |
| [0008](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0008-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0009](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0009-a2a-inbound-adapter.md) | An A2A inbound adapter (a read-only agent) | Accepted |
| [0010](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0011-wave-stop-cost-declaration.md) | Wave stop-cost declaration (cents, planner-declared) | Accepted |
| [0012](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0012-analytics-read-side.md) | Analytics read side | Accepted |
| [0013](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0013-stop-eta-window.md) | The day-of stop ETA window (StopEtaWindowAssigned at StartRoute) | Accepted |
| [0014](https://github.com/IQVO/last-mile-delivery/blob/develop/docs/adr/0014-delivery-point-profile.md) | The delivery-point profile (outcome detail, DeliveryPointFlagged) | Accepted |

### shipping-and-tracking

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0001-shipping-and-tracking-bounded-context.md) | Shipping & Tracking is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The ShippingLabel and PackageJourney aggregates, their invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts, local read models, relationships and the one synchronous call | Accepted |
| [0004](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0005-runtime-configuration-jobs-and-retention.md) | Runtime: configuration, periodic jobs, retention of the technical tables | Accepted |
| [0006](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0006-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0007](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0007-console-remote.md) | The console remote (shipping_mfe) — a read-only screen over the existing REST | Accepted |
| [0008](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0008-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0009](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0009-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0010](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0011-label-time-address-deliverability-check.md) | Label-time address deliverability check | Accepted |
| [0012](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0012-analytics-read-side.md) | Analytics read side | Accepted |
| [0013](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0013-day-of-eta-window-on-the-journey.md) | The day-of ETA window on the journey | Accepted |
| [0014](https://github.com/IQVO/shipping-and-tracking/blob/develop/docs/adr/0014-relay-the-delivery-point-flag-by-order-id.md) | Relay the delivery-point flag by orderId | Accepted |

### node-performance

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0001-node-performance-bounded-context.md) | Node Performance is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | The NodeScorecard aggregate, its invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0003-consumed-contracts-and-local-facts.md) | Consumed contracts, local facts, relationships and recompute | Accepted |
| [0004](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0005-outbox-relay-and-attempt-cap.md) | The outbox relay, its attempt cap and the CloudEvents encoder | Accepted |
| [0006](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0006-http-adapter-consumers-and-readiness.md) | The HTTP adapter, the consumers' failure policy, readiness and shutdown | Accepted |
| [0007](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0007-mcp-server-adoption.md) | A read-only MCP server | Accepted |
| [0008](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0008-console-remote.md) | A web console remote | Accepted |
| [0009](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0009-inbound-timeliness-and-accuracy-metrics.md) | Inbound timeliness and accuracy, two informational scorecard metrics | Accepted |
| [0010](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0010-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0011](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0011-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0012](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0012-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0013](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0013-fast-tier-eligibility-from-the-7-day-window.md) | Fast-tier eligibility from the 7-day window | Accepted |

### seller-inbound

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0001-seller-inbound-bounded-context.md) | Seller Inbound is a bounded context of the retail network | Accepted |
| [0002](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0002-aggregates-and-invariants.md) | SellerAccount, InboundPlan and InboundShipment: aggregates, invariants and the assumptions the model left open | Accepted |
| [0003](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-models.md) | Consumed contracts and local read models | Accepted |
| [0004](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted |
| [0005](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0005-seller-compliance-scorecard.md) | Seller compliance scorecard (informational) | Accepted |
| [0006](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0006-read-only-mcp-server.md) | A read-only MCP server | Accepted |
| [0007](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0007-console-web-remote.md) | A web console remote | Accepted |
| [0008](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0008-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted |
| [0009](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0009-a2a-inbound-adapter.md) | An A2A inbound adapter | Accepted |
| [0010](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0010-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted |
| [0011](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0011-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and the complete MCP surface | Accepted |
| [0012](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0012-the-placement-advisory.md) | The placement advisory (PlacementPlan) | Accepted |
| [0013](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0013-seller-status-is-an-integration-fact.md) | Seller status is an integration fact | Accepted |
| [0014](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0014-received-stock-is-published-per-item.md) | Received stock is published per item | Accepted |
