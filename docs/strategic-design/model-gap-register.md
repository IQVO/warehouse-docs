---
id: model-gap-register
title: Model Gap Register
sidebar_label: Model Gap Register
description: "Every gap the per-context packs found in model/model.yaml, deduplicated and grouped, with its severity and a proposed resolution that is not yet in the model."
---

# Model Gap Register

The ten context packs were written strictly from
[`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml).
Where the model was silent or contradicted itself, the pack did not invent an
answer: it marked the choice "proposed" or "this pack's reading" on the page and
reported a gap. 2026-10-22 produced about 140 reports. This page holds them
deduplicated into 40 items.

**Nothing on this page is in the model yet.** Each "Proposed resolution" is a
recommendation. A gap is closed only when `model.yaml` changes, the affected
packs are regenerated or edited, and `scripts/check_model.py` passes.

Severity:

| Severity | Meaning |
| --- | --- |
| **S1** | A cross-context flow cannot work as modelled: a policy has no data, or a fact never reaches the context that needs it. |
| **S2** | A race or failure path has no compensation: the happy path works, the unhappy one strands an aggregate. |
| **S3** | Incomplete inside one context: a missing transition, formula, vocabulary or route owner. |
| **S4** | Convention gaps shared by every context. |

## S1: flows that cannot work as modelled

| # | Gap | Contexts | Proposed resolution |
| --- | --- | --- | --- |
| G1 | `PackageDelivered` and `PackageExceptionRaised` carry `assignmentId` and `orderId` but no `promiseId`. `JudgeOnDelivery` and `RepromiseOnRisk` cannot find the promise. For a group shipped in several packages, the model does not say which delivery judges it. | delivery-promise, shipping-and-tracking | Add `promiseId` to `FulfillmentLocked`. `delivery-promise` keeps a local `assignmentId → promiseId` mapping. `FulfillmentShipped.trackingNumbers[]` gives the package set; the group is judged on the **last** package delivered (or the first lost). |
| G2 | `IssueLabel` input, `LabelIssued`, `PurchaseOrder` and `PurchaseOrderIssued` carry no `orderId`, but `shipping-and-tracking` needs it to read `GET /orders/{orderId}/ship-to`. | shipping-and-tracking, vendor-connectivity | `vendor-connectivity` already sees `orderId` on `FulfillmentReleasedToNode`. It adds `assignmentId` and `orderId` to the in-org `IssueLabel` call; the Vendor API stays without them. |
| G3 | `LoadDeparted` and `LoadArrived` carry no departure kind or node type. `HandoverOnFirstScan` cannot check "PICKUP load". `shipping-and-tracking` cannot tell an arrival at a station from one at a sort centre. There is also no `HANDED_OVER → AT_STATION` edge for direct injection (FC to station, the SAME_DAY path). | linehaul-transportation, shipping-and-tracking | Add `departureKind` and `destinationNodeType` to both events. Add the `HANDED_OVER → AT_STATION` transition. |
| G4 | `ackBy = min(issuedAt + ackWindow, requiredShipBy − handlingTime)` needs the node's `handlingTime`. `vendor-connectivity` does not consume `NodeOperationalProfileDeclared`. | vendor-connectivity, node-topology | `vendor-connectivity` consumes `NodeOperationalProfileDeclared` into `VendorNodeView`. |
| G5 | `DeliveryWaveCancelled` is analytics only. `delivery-promise` keeps promising on a cancelled wave, and `RepromiseOnRisk` does not see it. | last-mile-delivery, delivery-promise, order-sourcing | Promote it to an integration event consumed by `delivery-promise` (view and `RepromiseOnRisk`) and `order-sourcing` (`NetworkGraphView`). |
| G6 | `PackageLost` and `PackageReturned` are analytics only, so a lost package's promise is never judged. | shipping-and-tracking, delivery-promise | Promote both to integration events. `delivery-promise` judges `BROKEN` with cause `LOST`; a return before delivery is also `BROKEN`. |
| G7 | `ConfirmPromise` runs only when `delivery-promise` consumes `CustomerOrderPlaced`. If the hold has already expired, the promise is `RELEASED`, `PromiseReleased` is analytics only, and the order keeps a dead promise. | customer-ordering, delivery-promise | Confirm synchronously: `PlaceOrder` calls `POST /promises/{promiseId}:confirm` inside checkout, before the order is placed. A failed confirm makes checkout re-quote. `CustomerOrderPlaced` stays as the fact for everyone else. |
| G8 | A `DeliveryOffer` is quoted per (item, quantity, destination, tier), but a `Promise` covers a multi-line shipment group with one `offerId`. `DeliveryOffer` also stores neither `basis` nor `policyVersion`, which `PromiseMade` needs. | delivery-promise | Quote per shipment group: `DeliveryOffer.lines[]` (one line on a product page). Store `basis` and `policyVersion` on the offer. A `NOMINAL` witness path has no departure or wave ids. |
| G9 | `PromiseBook` has no creating command, no formula for `share` and no `CloseBook` trigger. The pickup departure's `capacityPackages` and destination are undefined: the node's cap counts orders, not packages. | delivery-promise, linehaul-transportation, node-topology | Open a book lazily on the first hold for a (node, cutoff). Set `share = min(CutoffSlot.maxOrders, throughputCap × window)` × the proportional share of D4. Close it at the cutoff, driven by the clock. A pickup departure uses the node's default outbound lane. Its capacity converts orders to packages at a declared `packagesPerOrder`, default 1. |
| G10 | `customer-ordering` has a policy that needs to know "no revised promise is feasible", but no event says so. `order-sourcing` has no `UNSOURCEABLE → CANCELLED` transition. | customer-ordering, delivery-promise, order-sourcing | `delivery-promise` publishes `PromiseUnkeepable` when re-promising finds no path. `customer-ordering` then cancels the group, and `order-sourcing` gets `UNSOURCEABLE → CANCELLED`. |
| G11 | Last-mile stops group packages by address, but last-mile never receives an address (ADR 0006). | last-mile-delivery, shipping-and-tracking | `shipping-and-tracking` derives an opaque `stopKey`, a keyed hash of the normalized address, at label time. `stopKey` and the postal prefix go on the label event. Last-mile groups by `stopKey`; partners resolve the address through a restricted label route. |

## S2: races and failure paths with no compensation

| # | Gap | Contexts | Proposed resolution |
| --- | --- | --- | --- |
| G12 | Cancel race: `order-sourcing` cancels a `RELEASED` assignment while the vendor is accepting its PO. `vendor-connectivity` refuses to cancel (`ErrCancelAfterAcknowledgement`), but no one is told, so the vendor may ship a cancelled group. | customer-ordering, order-sourcing, vendor-connectivity | `CustomerOrderCancelled` becomes a request. `order-sourcing` decides and publishes `FulfillmentCancelled` or `FulfillmentCancelRefused`. A refusal after acceptance means the vendor ships and the shopper's refusal becomes a return. `customer-ordering` shows the outcome; its own `ErrCancelAfterLock` is advisory. |
| G13 | `PromiseRevised` applies only to `UNSOURCEABLE`. A revision caused by a departure or a package exception leaves `QUEUED`, `RELEASED` and `LOCKED` assignments on a stale `deliverByLatest`. `ApplyRevisedPromise` emits no event. | order-sourcing | `ApplyRevisedPromise` applies in every non-terminal state and emits `FulfillmentConstraintRevised`. `PromiseConstraint` carries `revisionNo`, and node exclusions reset when it changes. |
| G14 | No rule covers a `LOCKED` assignment whose pickup departure is cancelled, a booking refused after acceptance (`ErrDepartureFull`), or bookings on a cancelled departure. | linehaul-transportation, order-sourcing, delivery-promise | `linehaul-transportation` rebooks onto the next departure from the same origin and publishes `BookingMoved`, or `BookingFailed` when none fits. `delivery-promise` re-promises on either. The node never changes after lock (ADR 0005). |
| G15 | The release branch of `BookOnLock` cannot fire: reassignment and cancellation happen only before `LOCKED`, and booking happens only at `LOCKED`. Only `PICKUP` departures are ever booked. | linehaul-transportation | Remove the release branch. Book line-haul and air legs when the package is loaded at a sort centre (`OpenLoad` / `LoadPackage`), not at lock. |
| G16 | `InductOnArrival` has no failure outcome when no wave is eligible. After three failed attempts there is no failure count, no event and no route to `ReturnToSender`. | last-mile-delivery, shipping-and-tracking | Publish `PackageInductionDeferred`, which `delivery-promise` treats as a risk. `PackageAttemptHistory` per tracking number counts failures. The third failure publishes `PackageReturnInitiated`, which `shipping-and-tracking` consumes into `ReturnToSender`. |
| G17 | `CancelWave` is allowed while packages are inducted. A stop has one outcome, but `DeliveryAttempted` is per package. | last-mile-delivery | Cancelling a wave re-inducts its packages onto the next wave. Outcomes are per package; the stop outcome is derived. |
| G18 | `VoidLabel` has no effect on the journey, and `LabelVoided` has no consumer. | shipping-and-tracking | Voiding closes a `LABELLED` journey as `VOIDED` and is refused after handover. `customer-ordering` and linehaul's `ExpectedVolumeView` consume `LabelVoided`. |

## S3: incomplete inside one context

| # | Gap | Context | Proposed resolution |
| --- | --- | --- | --- |
| G19 | `TierOrderDeadline` has no owner, route or event. There is no `OfferConstraint` for "past the deadline". | delivery-promise | Make it part of a `PromisePolicy` aggregate (versioned) with `PromisePolicyPublished`, and add the `PAST_ORDER_DEADLINE` constraint. |
| G20 | `ScorecardHandicap` has no rule for grade `PROVISIONAL` and does not say which window applies (7-day or 30-day). The same is true of `AssignmentCost`. | delivery-promise, order-sourcing, node-performance | `PROVISIONAL` adds no handicap. Both use the 30-day window; the 7-day window feeds alerts only. |
| G21 | `RevisePromise` does not say whether capacity moves to the new book. `CustomerOrderCancelled` is consumed, but nothing maps it to `CancelPromise`. | delivery-promise | A revision moves the hold (hold new, release old) in one transaction. `CustomerOrderCancelled` triggers `CancelPromise`, which releases confirmed capacity. |
| G22 | `MakePromise` changes three aggregates (offer, promise, book). | delivery-promise | One local transaction. All three are in one database and the book row is the contention point. This is a documented exception to "one aggregate per transaction". |
| G23 | Feed rules are unclear. The model does not say whether a stale line is an error or how an all-stale feed ends. A `FAILED` feed cannot be resent. An older feed should be ignored but has no state. "Applied atomically across every listing" conflicts with one aggregate per transaction. | offer-availability | A stale line is skipped and counted, and the feed is `APPLIED`. Add the `SUPERSEDED` state for an older feed. A `FAILED` feed id may be resent. A feed is one transaction, bounded at 10,000 lines per node (larger feeds are split by the vendor). |
| G24 | No initial listing state on a non-sellable node. No rule for what discontinuing an item does to its listings. No basis for a zeroed availability. | offer-availability | Create the listing as `SUPPRESSED` (reason `NODE_NOT_SELLABLE`). Discontinuing suppresses all listings (reason `DISCONTINUED`). Zeroing keeps the basis and stamps `asOf` = the feed's time. |
| G25 | `customer-ordering` never maps consumed events to commands. Its cancel wording contradicts itself, `IN_FULFILLMENT → CANCELLED` is unreachable, and there is no partially delivered state. | customer-ordering | Model the mappings the pack already used. "Cancel while any group is unlocked" applies to those groups only. Add `PARTIALLY_DELIVERED`. `GroupPromise` gains `tier`, `shipBy` and a per-group status. |
| G26 | `VirtualQueue` does not say when an assignment with no candidates becomes `UNSOURCEABLE`. "Cross-region only when it is the only way" (a filter) conflicts with `crossRegionPenalty` (a cost). The destination is not on `PromiseConstraint`. | order-sourcing | Declare it unsourceable immediately when the candidate set empties. Cross-region is a penalty, and the business decision text is corrected. Add `destinationPostalPrefix` to `PromiseConstraint`. |
| G27 | Node rules are incomplete. A cutoff has no day of week. The model does not say whether a profile revision on an active FC may remove all cutoffs. Nothing checks `regionId`. Nothing restricts `subtype`. Nothing covers lanes and service areas of a suspended node. `sortDwell` is undefined. | node-topology | `CutoffSlot` gains `days[]` (default: every operating day). `ErrIncompleteOperationalProfile` applies to every revision of an `ACTIVE` node. Add `ErrUnknownRegion`. `subtype` is allowed only from `node_types`. Suspending a node publishes `NodeSuspended`, and consumers treat its lanes and areas as unusable without closing them. `sortDwellMinutes` is declared by sort centres and air hubs. |
| G28 | `PickupFromCutoffs` fires on profile declaration, but pickups exist only for `ACTIVE` nodes. `NodeActivated` has no reaction. No command changes departure capacity. `CloseDeparture`, `RecordDeparture` and `RecordArrival` have no actor. | linehaul-transportation | Generate pickups on `NodeActivated` and on profile revisions of active nodes. Add `ChangeDepartureCapacity` for the planner. Departure and arrival are recorded by `DispatchLoad` and `ReceiveLoad`. |
| G29 | Lane schedules have no field model. | linehaul-transportation | Adopt the pack's slot shape (`dayOfWeek`, local cutoff, departs and arrives, `capacityPackages`). A redefinition replaces slots from the next horizon roll. |
| G30 | Vendor suspension has no route, event or rule. A vendor never learns the `nodeId` its registration created, and there is no route to list its nodes. | vendor-connectivity | Add `VendorSuspended` and `VendorReinstated`; a suspended vendor's writes are refused. Return `nodeId` on the processed `NODE_REGISTRATION` transaction. Add `GET /vendor/nodes`. |
| G31 | Label requests conflict with the async rule: every vendor write returns `202` + `transactionId`, but a label is needed synchronously to pack. | vendor-connectivity | A label is the documented exception: `200` with `{labelRef, trackingNumber, carrier}` (the contract already does this). |
| G32 | Vendor identity under no-auth. `ErrNodeNotOwnedByVendor` cannot be checked on reads. | vendor-connectivity | `vendorId` goes in every write body and as a required query parameter on reads. Ownership is checked against it; this is a consistency check, not security. |
| G33 | Scorecard metrics lack definitions: denominators, the late-ack window, freshness sampling, direction of "downward" for metrics where higher is worse, `minObservations`, creation and the `PROVISIONAL` recompute. No rule says which `PromiseBroken` causes count against the node. | node-performance | Define each metric with a numerator, denominator and better-direction. `minObservations` = 50. The first observation creates a `PROVISIONAL` card, and recompute below the minimum stays `PROVISIONAL` without publishing. Only node-attributable causes (`LATE_HANDOVER`, `VENDOR_REJECT`, `ACK_EXPIRED`) count. |
| G34 | `DeliveryServicePartner` has no transitions or fields. `PlanRoute` is not tied to wave inductions. `CompleteWave`, `CancelWave` and `CompleteRoute` have no trigger. | last-mile-delivery | Add `DeactivatePartner` and the fields the pack used. A route may hold only packages inducted in its wave, and only from `INDUCTION_CLOSED`. A wave completes when its last route does. |

## S4: conventions shared by every context

| # | Gap | Proposed resolution |
| --- | --- | --- |
| G35 | No `Err…` identifiers for not found, an illegal transition, or an optimistic-concurrency conflict. The packs used ad hoc slugs. | Add to `conventions`: `ErrNotFound` (404 `not-found`), `ErrIllegalTransition` (409 `illegal-transition`), `ErrConcurrentUpdate` (409 `concurrent-update`), `ErrValidation` (422 `validation-failed`). |
| G36 | REST routes with no inbound row, and inbound rows with no caller's `sync_calls`. | `check_model.py` gains a rule: every `rest` route maps to one inbound row and vice versa. |
| G37 | Reason vocabularies are not enumerated (cancel, reject, lock, exception, broken cause and others). | One `reasons:` table per context in the model. |
| G38 | Analytics-only events have no topic rule. | Analytics-only events go to `retailnetwork.<context>.analytics` only. |
| G39 | No idempotency storage is modelled, yet every pack added an `idempotency_keys` table. | Make it a convention: an infrastructure table per context, keyed by (route, key), with a 24-hour TTL. |
| G40 | No retention rule for the ship-to snapshot. | Purge it 30 days after `PackageDelivered`, `PackageReturned` or `PackageLost`. |

## How a gap gets closed

1. Edit `model/model.yaml`.
2. Run `python3 scripts/check_model.py --pages` and `python3 scripts/gen_pages.py`.
3. Update the affected context packs and OpenAPI files. Remove the "proposed" or "this pack's reading" marker where the model now decides.
4. Delete the row here.
