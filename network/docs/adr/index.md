---
id: index
slug: /adr
title: Architecture Decision Records
sidebar_label: Index
sidebar_position: 1
description: "The proposed decisions behind the retail-network model."
---

# Architecture Decision Records

All eight are **Proposed**: they become Accepted when the network's
repositories are created and the user accepts them. Each context repository
will then carry its own ADR sequence; these are domain-level decisions.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](/adr/0001-retail-network-domain-of-ten-contexts) | The retail network is its own domain of ten bounded contexts | Proposed |
| [0002](/adr/0002-promise-and-assignment-are-separate) | Promise and order assignment are separate contexts | Proposed |
| [0003](/adr/0003-declared-and-measured-capability) | Capability is declared and measured | Proposed |
| [0004](/adr/0004-parcel-nodes-are-network-operated) | Parcel nodes are network-operated | Proposed |
| [0005](/adr/0005-vendor-acceptance-is-the-path-lock) | The vendor node's acceptance is the path lock | Proposed |
| [0006](/adr/0006-pii-confinement) | PII is confined to customer-ordering and shipping-and-tracking | Proposed |
| [0007](/adr/0007-cloudevents-namespace) | CloudEvents namespace com.retailnetwork, no shared topic | Proposed |
| [0008](/adr/0008-capacity-held-at-promise-time) | Fast tiers are never promised from nominal times, and capacity is held at promise time | Proposed |
