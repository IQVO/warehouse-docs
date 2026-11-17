---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "The four events Customer Returns publishes and the nine it consumes, with full CloudEvents types, payloads and idempotency rules."
---

# Domain Events

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

Every event this context publishes (`contexts[customer-returns].publishes`) and
consumes (`.consumes`), with the envelope rules of `conventions.cloudevents`
([event standard](/network/strategic-design/event-standard-cloudevents),
[ADR 0007](/network/adr/0007-cloudevents-namespace)).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox |
| `source` | `/retailnetwork/customer-returns` |
| `type` | `com.retailnetwork.commerce.customer-returns.<entity>.<EventName>` (tier `commerce`; the single entity `returnauthorization`) |
| `subject` | the aggregate root id, the `authorizationId` |
| `time` | the instant the fact became true |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:customer-returns:events:<EventName>:v<version>`, where the version is the aggregate version after the change: `v1` for `ReturnAuthorized`, `v2` or higher for later events of the same authorization (policy `OutboxVersionedSchema`) |
| Kafka topic | `retailnetwork.customer-returns.events` |
| Kafka key | the `subject` |

Quantities are eaches. Every optional field that does not apply is omitted,
never defaulted. No event carries a unit price, an address, a name, a phone
number or free text.

## Published

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `ReturnAuthorized` | `com.retailnetwork.commerce.customer-returns.returnauthorization.ReturnAuthorized` | `vendor-connectivity` |
| `ReturnLabelIssued` | `com.retailnetwork.commerce.customer-returns.returnauthorization.ReturnLabelIssued` | `vendor-connectivity` |
| `ReturnCompleted` | `com.retailnetwork.commerce.customer-returns.returnauthorization.ReturnCompleted` | `offer-availability` |
| `ReturnCancelled` | `com.retailnetwork.commerce.customer-returns.returnauthorization.ReturnCancelled` | `vendor-connectivity` |

`vendor-connectivity` consumes `ReturnAuthorized`, `ReturnLabelIssued` and
`ReturnCancelled` into its return advices (`ReturnAdviceView`, its ADR 0014);
the consumer is in its `develop` contract.

### Payloads

| Event | Fields (from the model) |
| --- | --- |
| `ReturnAuthorized` | `authorizationId`, `orderId`, `groupNo`, `reason`, `disposition`, `method`, `lines` (`lineNo`, `catalogItemId`, `quantity`, `ownerRef` (optional)), `destinationNodeId` (optional, omitted for `KEEP`), `originNodeId` (optional), `pickupWindowStart` and `pickupWindowEnd` (optional, `PICKUP` only), `expiresAt`, `authorizedAt` |
| `ReturnLabelIssued` | `authorizationId`, `trackingNumber`, `destinationNodeId`, `issuedAt` |
| `ReturnCompleted` | `authorizationId`, `outcome`, `nodeId`, `lines` (`catalogItemId`, `ownerRef` (optional), `qtyRestockable`, `qtyUnsellable`), `receivedAt` |
| `ReturnCancelled` | `authorizationId`, `reason`, `cancelledAt` |

Value sets: `reason` of an authorization is `DEFECTIVE`, `NOT_AS_DESCRIBED`,
`WRONG_ITEM`, `NOT_NEEDED` or `OTHER`; `disposition` is `KEEP`,
`NEAREST_RETURNS_CENTER` or `ORIGIN_NODE`; `method` is `DROP_OFF` or
`PICKUP`; `outcome` is `RECEIVED`; `reason` of a cancellation is
`SHOPPER_REQUESTED` or `EXPIRED`. `ReturnAuthorized` is raised for every
disposition, `KEEP` included. `ReturnCompleted` carries the authorized lines
only; lines beyond the authorization are never published.

### Example envelope

`ReturnCompleted` is the restock fact `offer-availability` applies. The
values are illustrative.

```json
{
  "specversion": "1.0",
  "id": "5d2c9a10-7b3e-4f61-9c0a-2e8b6d4f1a77",
  "source": "/retailnetwork/customer-returns",
  "type": "com.retailnetwork.commerce.customer-returns.returnauthorization.ReturnCompleted",
  "subject": "ret-0f3a91e2",
  "time": "2026-11-20T15:30:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:customer-returns:events:ReturnCompleted:v3",
  "data": {
    "authorizationId": "ret-0f3a91e2",
    "outcome": "RECEIVED",
    "nodeId": "node-rc-1",
    "lines": [
      {"catalogItemId": "sku-100", "ownerRef": "sel-42", "qtyRestockable": 1, "qtyUnsellable": 1}
    ],
    "receivedAt": "2026-11-20T15:30:00Z"
  }
}
```

## Consumed

Every consumer dispatches on the full `type` string and is idempotent on the
CloudEvents `id` (`processed_events` inbox).

| Producer | Full `type` | What this context does |
| --- | --- | --- |
| `customer-ordering` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` | Writes one `OrderGroupView` row per group with status `PROMISED`, the destination postal prefix, the witness node and the placed lines. Never demotes a status a notice already set. |
| `customer-ordering` | `com.retailnetwork.commerce.customer-ordering.order.ShopperNoticeDecided` | For the families `GROUP_SHIPPED`, `GROUP_DELIVERED`, `GROUP_LOST` and `GROUP_RETURNED` sets the group status (the status of the fact wins over the family). Other families are ignored. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | Creates the node in `ReturnsNetworkView`. Only `RETURNS_CENTER` nodes ever influence a disposition. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | An `ACTIVE` returns centre becomes a candidate destination. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | The returns centre stops being a candidate at once. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | The node is never a destination again. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | Stores which region a postal prefix belongs to; the highest `assignmentVersion` wins. |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | Stores the per-item `ownerRef` of the release on the group's origin row. |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | Stores the fulfilling node: the `ORIGIN_NODE` fallback. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.returnoutcome.VendorReturnOutcomeSubmitted` | Completes the first open authorization the graded outcome fits (`RECEIVED`, `ReturnCompleted` with the authorized lines only); every outcome is recorded on `ReturnOutcomeFacts`, lines beyond the authorization flagged unexpected. |

As built (service ADR 0003): one consumer per producer topic, each under a
mandatory group variable (`ORDER_CONSUMER_GROUP`, `TOPOLOGY_CONSUMER_GROUP`,
`SOURCING_CONSUMER_GROUP`, `VENDOR_CONSUMER_GROUP`). A transient failure is
retried with capped backoff; a payload that can never apply is dead-lettered
to `<topic>.dlq`. A type the context does not act on is committed past.

The fourth consumer reads `retailnetwork.vendor-connectivity.events` for the
vendor's graded outcome, `VendorReturnOutcomeSubmitted`, the last row of the
table: `vendor-connectivity` publishes it since its ADR 0014 shipped, and the
model has a `consumes` row for it.
