---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One proposed application service per Seller Inbound command, with preconditions, main flow, errors mapped to HTTP, events and idempotency."
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One proposed application service per command in
`contexts[seller-inbound].aggregates[*].commands`, under
`internal/application/usecases`. Runtime views of the key ones are on
[Sequence Diagrams](/network/contexts/seller-inbound/sequence-diagrams).
Reads (`GetInboundShipment`, `GetLabels`) go straight to the repository.

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
| `ErrNodeCannotReceive` | 422 | `node-cannot-receive` |
| `ErrCasePackNotUniform` | 422 | `case-pack-not-uniform` |
| `ErrCaseQtyMismatchesGtin` | 422 | `case-qty-mismatches-gtin` |
| `ErrCartonOverweight` | 422 | `carton-overweight` |
| `ErrCartonOversize` | 422 | `carton-oversize` |
| `ErrSsccNotUnique` | 409 | `sscc-not-unique` |
| `ErrInvalidSscc` | 422 | `invalid-sscc` |
| `ErrCartonContentsMismatchPlan` | 422 | `carton-contents-mismatch-plan` |
| `ErrShipmentNotLabelled` | 409 | `shipment-not-labelled` |
| `ErrValidation`, `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate` | 422, 404, 409, 409 | the shared slugs from `conventions.errors` |

## OnboardSeller

- **Actor / trigger:** a seller or its portal. REST `POST /sellers`.
- **Flow:** validate `sellerId` (an `ownerRef`: at most 64 characters of
  letters, digits, `.`, `_`, `-`) and `name`; save `ACTIVE`; write
  `SellerOnboarded` to the outbox.
- **Errors:** `ErrSellerExists`, `ErrValidation`.
- **Events:** `SellerOnboarded`.

## SuspendSeller / ReinstateSeller

- **Actor:** network partner manager. REST `POST /sellers/{sellerId}:suspend`
  and `:reinstate`.
- **Flow:** `ACTIVE` ↔ `SUSPENDED`. A suspended seller's later `CreateInboundPlan`,
  `ConfirmInboundPlan`, `CreateInboundShipment`, `AddCarton`, `LabelShipment` and
  `ShipInboundShipment` are refused. Shipments already `SHIPPED` still close.
- **Errors:** `ErrNotFound`, `ErrIllegalTransition`.
- **Events:** `SellerSuspended`, `SellerReinstated`.

## CreateInboundPlan

- **Actor:** seller. REST `POST /inbound-plans`.
- **Preconditions:** seller `ACTIVE`; destination node `ACTIVE` with `INBOUND`
  in `NodeInboundView`.
- **Flow:** validate each line (live catalogue item in `CatalogPackagingView`,
  GTIN of 8, 12, 13 or 14 digits with a valid check digit, normalised to
  14 digits, `qtyEaches > 0`); if `CASE_PACKED`, each line's item must have an
  active CASE level. Save `DRAFT`.
- **Errors:** `ErrSellerSuspended`, `ErrNodeCannotReceive`, `ErrValidation`.
- **Events:** none (`DRAFT` is private to the seller).

## ConfirmInboundPlan / CancelInboundPlan

- **REST:** `POST /inbound-plans/{planId}:confirm`, `:cancel`.
- **Flow:** `DRAFT → CONFIRMED` re-checks seller and node; `DRAFT → CANCELLED`.
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
  2. `HOMOGENEOUS_CASE`: one item, `gtin` is the CASE-level GTIN, `qtyEaches`
     equals its `unitsPerPack` (`ErrCaseQtyMismatchesGtin`), and equals the
     other cartons of that item (`ErrCasePackNotUniform`). `MIXED`: contents are
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

- **REST:** `POST /inbound-shipments/{shipmentId}:label`.
- **Flow:** `DRAFT → LABELLED`. Checks that contents, summed per item over the
  plan's shipments, do not exceed the plan lines (and equal them for a
  single-shipment plan). After this, `GET .../labels` returns one printable
  label per carton.
- **Errors:** `ErrCartonContentsMismatchPlan`, `ErrSellerSuspended`, `ErrIllegalTransition`.
- **Events:** `InboundShipmentLabelled`.

## ShipInboundShipment

- **REST:** `POST /inbound-shipments/{shipmentId}:ship`.
- **Flow:** `LABELLED → SHIPPED`, re-checks the node and the seller.
- **Errors:** `ErrShipmentNotLabelled`, `ErrNodeCannotReceive`, `ErrSellerSuspended`.
- **Events:** `InboundShipmentShipped` (the carton manifest).

## RecordInboundReceipt

- **Trigger:** consumer of `InboundReceiptSubmitted` (no HTTP).
- **Flow:** for each carton in the receipt, store its status and the received
  eaches per GTIN. Raise `InboundDiscrepancyRecorded` for each `MISSING`,
  `UNEXPECTED` or `DAMAGED` carton and each quantity difference, and
  `SellerComplianceViolationRecorded` for each compliance code. When every
  carton of the manifest has a final status the shipment closes: `CLOSED` if
  nothing differs, otherwise `CLOSED_WITH_DISCREPANCY`, and
  `InboundShipmentReceived` is raised. Otherwise it stays `RECEIVING`.
- **Errors:** none returned. A receipt for an unknown shipment is logged and
  dropped (the Vendor API refuses it first: `ErrUnknownInboundShipment`).
- **Idempotency:** the CloudEvents `id` in the inbox; a repeated carton status
  is not recounted.
