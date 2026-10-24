---
id: index
slug: /adr
title: Architecture Decision Records
sidebar_label: Index
sidebar_position: 1
description: "The proposed decisions behind the retail-network model."
---

# Architecture Decision Records

All nine are **Proposed**. The ten context repositories exist and are
built — 0001 to 0008 are realized by them; 0009 (`seller-inbound`) has no
repository yet — and each repository carries its own ADR sequence on top of
these domain-level decisions. An ADR becomes Accepted when the user accepts
it.

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
