---
id: vendor-api
title: The Vendor API (Published Language)
sidebar_label: Vendor API
description: "The Open Host Service the warehouse-systems fleet conforms to: every route, its semantics, the asynchronous transaction pattern, rate limits and what is deliberately absent."
---

# The Vendor API (Published Language)

:::info[Proposed design]
Contract: [`apis/vendor-connectivity/openapi.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/apis/vendor-connectivity/openapi.yaml),
rendered under [API Reference](/api-reference). Owner:
[`vendor-connectivity`](/contexts/vendor-connectivity). The protocol keeps the
shape of Vendor Direct Fulfillment (poll, acknowledge in full, label after
acceptance, confirm shipment) in this network's own vocabulary, as the fleet's
`network-fulfillment` ADR 0009 expects.
:::

## Routes

| Route | Purpose | Answer |
| --- | --- | --- |
| `POST /vendor/nodes` | register a vendor node (`vendorNodeCode`, type, subtype, address) | `202 {transactionId}`; the transaction result carries `nodeId` |
| `GET /vendor/nodes/{nodeId}` | the node as the network sees it | `200` |
| `PUT /vendor/nodes/{nodeId}/profile` | declare the operational profile (revisioned) | `202 {transactionId}` |
| `GET /vendor/nodes/{nodeId}/scorecard` | the node's measured scorecard and grade | `200` |
| `POST /vendor/inventory` | availability per listing, full or partial | `202 {transactionId}` |
| `GET /vendor/purchase-orders?createdAfter=&nodeId=&nextToken=` | poll purchase orders, paged | `200 {purchaseOrders, nextToken}` |
| `GET /vendor/purchase-orders/{poNumber}` | one purchase order | `200` |
| `POST /vendor/acknowledgements` | accept or reject a purchase order in full | `202 {transactionId}` |
| `POST /vendor/shipping-labels` | a label per package of an accepted order | `200 {labelRef, trackingNumber, carrier}` |
| `POST /vendor/shipment-confirmations` | confirm shipment with the tracking numbers | `202 {transactionId}` |
| `GET /vendor/transactions/{transactionId}` | outcome of any write | `200 {status: PROCESSING or SUCCESS or FAILURE, errors}` |

## Semantics a vendor must implement

1. **A 202 is not a commitment.** A write takes effect when its transaction
   is `SUCCESS`. Model "submitted, not reconciled" as its own state.
2. **Fill-or-kill.** One decision for every line of a purchase order. A
   partial acknowledgement is refused (`ErrPartialAcknowledgement`).
3. **One answer, in time.** Acknowledge once (`ErrAlreadyAcknowledged`)
   before `ackBy` (`ErrAckWindowClosed`); after `ackBy` the order is
   `EXPIRED` and goes to another node.
4. **Label after acceptance, confirmation after label**
   (`ErrLabelBeforeAcceptance`, `ErrConfirmWithoutLabel`).
5. **Rate limits are contract.** `429` with `Retry-After`; a vendor backs off
   and never drops the call.
6. **Redelivery happens.** The same `poNumber` can appear on two polls; the
   vendor deduplicates.

## Deliberately absent

- **No ship-to address**, name or phone, in any schema, in either direction.
- **No delivery promise.** A purchase order carries `requiredShipBy`, not the
  customer's window.
- **No push to the vendor.** Demand is polled; the network never calls the
  vendor.

## Simulation knobs

Because both sides are in one ecosystem, the network can misbehave on purpose
so the vendor's crash-safety is testable: `TX_PROCESSING_DELAY`,
`TX_FAILURE_RATE`, `RATE_LIMIT_RPS`, `PO_REDELIVERY_RATE`. All default to
well-behaved; end-to-end scenarios set them per run.
