---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One application service per Seller Inbound command, with preconditions, main flow, errors mapped to HTTP, events and idempotency."
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound), designed by [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0002 to 0005 record what it does.
:::

One application service per command in
`contexts[seller-inbound].aggregates[*].commands`, under
`internal/application/usecases`. Runtime views of the key ones are on
[Sequence Diagrams](/network/contexts/seller-inbound/sequence-diagrams).
Reads (`GetInboundPlan`, `GetInboundShipment`, `GetLabels`) go straight to the repository;
`GetSellerScorecard` (`GET /sellers/{sellerId}/scorecard`, service ADR 0005) computes an
informational scorecard from this service's own facts and changes nothing.
`GetSellerCapacityAllocations`
(`GET /sellers/{sellerId}/capacity-allocations?month=`, service ADR 0015) reads
the seller's inbound capacity reservations of one calendar month (`month` is a
`YYYY-MM` key and defaults to the current month), ordered by `nodeId`; it
publishes no event, an unknown seller answers 404 and a malformed month 422.

## Conventions for every use case

- **Errors** are RFC 9457 `application/problem+json`: validation `422`,
  conflict or state `409`, not found `404`, stale version `409`.
- **Idempotency-Key** on every `POST`. A repeat with the same key returns the
  first response.
- **One transaction** per use case: the aggregate change, its outbox rows,
  and (for consumers) the inbox row commit together.
- **Read models are local.** `NodeInboundView` and `CatalogPackagingView` are
  read inside the use case; no synchronous call leaves the context.

| Model error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrSellerExists` | 409 | `seller-exists` |
| `ErrSellerSuspended` | 409 | `seller-suspended` |
| `ErrNodeCannotReceive` | 409 | `node-cannot-receive` |
| `ErrCasePackNotUniform` | 422 | `case-pack-not-uniform` |
| `ErrCaseQtyMismatchesGtin` | 422 | `case-qty-mismatches-gtin` |
| `ErrCartonOverweight` | 422 | `carton-overweight` |
| `ErrCartonOversize` | 422 | `carton-oversize` |
| `ErrSsccNotUnique` | 409 | `sscc-not-unique` |
| `ErrInvalidSscc` | 422 | `invalid-sscc` |
| `ErrCartonContentsMismatchPlan` | 422 | `carton-contents-mismatch-plan` |
| `ErrShipmentNotLabelled` | 409 | `shipment-not-labelled` |
| `ErrInboundCapacityExceeded` | 422 | `inbound-capacity-exceeded` |
| `ErrNetworkSplitDestination` | 422 | `network-split-destination` |
| `ErrNetworkSplitUnavailable` | 422 | `network-split-unavailable` |
| `ErrInvalidWindow` (scorecard read) | 400 | `invalid-window` |
| `ErrValidation`, `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate` | 422, 404, 409, 409 | the shared slugs from `conventions.errors` |

## OnboardSeller

- **Actor / trigger:** a seller or its portal. REST `POST /sellers`.
- **Flow:** validate `sellerId` (an `ownerRef`: at most 64 characters of
  letters, digits, `.`, `_`, `-`; a `:` is refused, unlike the opaque plan, shipment and node ids) and `name`; save `ACTIVE`; write
  `SellerOnboarded` to the outbox.
- **Errors:** `ErrSellerExists`, `ErrValidation`.
- **Events:** `SellerOnboarded`.

## SuspendSeller / ReinstateSeller

- **Actor:** network partner manager. REST `POST /sellers/{sellerId}/suspensions`
  and `POST /sellers/{sellerId}/reinstatements`.
- **Flow:** `ACTIVE` ↔ `SUSPENDED`. A suspended seller's later `CreateInboundPlan`,
  `ConfirmInboundPlan`, `CreateInboundShipment`, `AddCarton`, `LabelShipment` and
  `ShipInboundShipment` are refused. Shipments already `SHIPPED` still close.
- **Repeat:** suspending a `SUSPENDED` seller, or reinstating an `ACTIVE` one,
  is a no-op: `200` with the account unchanged and no event (service ADR 0002
  A3). It is not an `ErrIllegalTransition`. The seller account is the only
  aggregate that is idempotent by state; every other command is strict.
- **Errors:** `ErrNotFound`.
- **Events:** `SellerSuspended`, `SellerReinstated` (a repeat raises none).

## CreateInboundPlan

- **Actor:** seller. REST `POST /inbound-plans`.
- **Preconditions:** seller `ACTIVE`; destination node `ACTIVE` with `INBOUND`
  in `NodeInboundView`.
- **Flow:** validate each line (1 to 500 lines, one per catalogue item; whether
  the item is live is not checked, since no `CatalogItemCreated` or
  `CatalogItemDiscontinued` is consumed; GTIN of 8, 12, 13 or 14 digits with a valid check digit, normalised to
  14 digits, `qtyEaches > 0`, an optional `unitVolumeDm3` of 1 to 100000). Run
  the monthly capacity gate (service ADR 0015): when the node declares
  `monthlyVolumeDm3` and every line declares `unitVolumeDm3`, the seller's
  reserved volume for the (month, node) plus the plan's volume must stay within
  the node's monthly volume times the seller's tier factor (`GOOD` 100%,
  `WATCH` 80%, `AT_RISK` 50%); when either side is unknown the plan is allowed
  and records `capacityEnforced: false`. A `NETWORK_SPLIT` plan must
  destination an `ACTIVE` `INBOUND_CROSS_DOCK` whose region holds at least one
  `ACTIVE` `FULFILLMENT_CENTER`, and records its redistribution
  (capacity-split-v1) and fee basis. Reserve the plan's volume and save
  `DRAFT`. The plan is not checked against
  `CatalogPackagingView`: whether a `CASE_PACKED` item has an active CASE
  level is enforced on `AddCarton`, not here (service use-cases page,
  `CreateInboundPlan`).
- **Errors:** `ErrSellerSuspended`, `ErrNodeCannotReceive`, `ErrValidation`,
  `ErrInboundCapacityExceeded`, `ErrNetworkSplitDestination`,
  `ErrNetworkSplitUnavailable`.
- **Events:** none (`DRAFT` is private to the seller).

## ConfirmInboundPlan / CancelInboundPlan

- **REST:** `POST /inbound-plans/{planId}/confirmations` and
  `POST /inbound-plans/{planId}/cancellations`.
- **Flow:** `DRAFT → CONFIRMED` re-checks seller and node and keeps the
  capacity reservation; `DRAFT → CANCELLED` releases it (service ADR 0015).
  `CONFIRMED` and `CANCELLED` are terminal: a second confirm or cancel is
  `ErrIllegalTransition` (service ADR 0002 A3).
- **Errors:** `ErrSellerSuspended`, `ErrNodeCannotReceive`, `ErrIllegalTransition`.
- **Events:** `InboundPlanConfirmed` (confirm only).

## CreateInboundShipment

- **REST:** `POST /inbound-plans/{planId}/shipments`.
- **Preconditions:** plan `CONFIRMED`; seller `ACTIVE`; node still receivable.
- **Flow:** create an empty `DRAFT` shipment for the plan's destination node.
- **Errors:** `ErrIllegalTransition`, `ErrSellerSuspended`, `ErrNodeCannotReceive`.

## AddCarton

- **REST:** `POST /inbound-shipments/{shipmentId}/cartons`.
- **Preconditions:** shipment `DRAFT`.
- **Flow:**
  1. Validate contents (GTINs, `qtyEaches > 0`, optional `lot` up to 20
     characters and `expiry` date).
  2. `HOMOGENEOUS_CASE` (every carton of a `CASE_PACKED` plan): one item, `gtin`
     is the CASE-level GTIN, `qtyEaches` equals the `unitsPerPack` of the item's
     active CASE level, checked here and not at plan creation
     (`ErrCaseQtyMismatchesGtin`); the carton holds exactly one item, one GTIN
     and one quantity (`ErrCasePackNotUniform`). `MIXED`: contents are
     each-level GTINs and the carton gets no pack GTIN.
  3. Check weight and dimensions against the node's `inbound` limits.
  4. SSCC: a supplied one must be valid and unique (`SsccIssuance`); otherwise
     issue one from the network's company prefix.
  5. Save the carton; return it with its label reference.
- **Errors:** `ErrCasePackNotUniform`, `ErrCaseQtyMismatchesGtin`,
  `ErrCartonOverweight`, `ErrCartonOversize`, `ErrInvalidSscc`,
  `ErrSsccNotUnique`, `ErrSellerSuspended`, `ErrIllegalTransition`.
- **Idempotency:** the SSCC itself is a natural key: re-adding the same SSCC
  to the same shipment with the same key returns the first response; with a
  new key it is `ErrSsccNotUnique`.

## LabelShipment

- **REST:** `POST /inbound-shipments/{shipmentId}/labels`.
- **Flow:** `DRAFT → LABELLED`. A plan may be filled by several shipments over
  time. When this is the plan's only shipment, the eaches per item and GTIN over
  its cartons must equal the confirmed plan's lines, every line exactly
  (`Shipment.Label` with `SingleShipment`). When the plan has several shipments
  no exact match is required at labelling: `AddCarton` has already kept every
  item on the plan and the total over this shipment and the plan's other
  shipments within each plan line (service use-cases page). After this,
  `GET .../labels` returns one printable label per carton.
- **Errors:** `ErrCartonContentsMismatchPlan`, `ErrSellerSuspended`, `ErrIllegalTransition`.
- **Events:** `InboundShipmentLabelled` (the carton manifest, with contents, weights and sizes).

## ShipInboundShipment

- **REST:** `POST /inbound-shipments/{shipmentId}/dispatches`.
- **Flow:** `LABELLED → SHIPPED`, re-checks the node and the seller.
- **Errors:** `ErrShipmentNotLabelled`, `ErrNodeCannotReceive`, `ErrSellerSuspended`.
- **Events:** `InboundShipmentShipped` (`shippedAt`; the manifest was published on `InboundShipmentLabelled`).

## RecordInboundReceipt

- **Trigger:** consumer of `InboundReceiptSubmitted` (no HTTP).
- **Flow:** for each carton in the receipt, store its status and the received
  eaches per GTIN. Raise `InboundDiscrepancyRecorded` for each `MISSING`,
  `UNEXPECTED` or `DAMAGED` carton and each quantity difference, and
  `SellerComplianceViolationRecorded` once per distinct compliance code on a
  carton; an unexpected carton also raises the code `UNMANIFESTED_CARTON`
  (service ADR 0002 A8). When every
  carton of the manifest has a final status the shipment closes: `CLOSED` if
  nothing differs, otherwise `CLOSED_WITH_DISCREPANCY`, and
  `InboundShipmentReceived` is raised. Otherwise it stays `RECEIVING`.
- **Errors:** none returned. A receipt for a shipment that does not exist is
  dead-lettered at once to `<topic>.dlq` (service ADR 0003); the Vendor API
  normally refuses it first with 404 `not-found`.
- **Idempotency:** the CloudEvents `id` in the inbox; a repeated carton status
  is not recounted.
