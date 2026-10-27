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

## Service ADRs (one sequence per context repository)

Each of the eleven context repositories records its own decisions on top of
the domain-level ones above: 95 ADRs on `develop` as of 2026-10-26. They are
linked, never copied; the *Status* column is the word from each ADR's own
status line. Every repository's newest ADR adopts the fleet observability
standard (logs, metrics, traces, exported over OTLP to the otel-collector, plus
one Tier-2 business counter per context), accepted on 2026-10-26
(`customer-ordering`: 2026-10-25).


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
