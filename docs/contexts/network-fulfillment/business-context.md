---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why selling fulfillment capability to an external retail network is a domain problem — capability reaches a network only as consequences — and why that integration is its own bounded context rather than an adapter inside order-management.
---

# Business Context

## The question that started it

The fleet models a building that knows, in real terms, what it can do.
`process-path-management` owns per-path `cycleTimeP95` and a site-scoped
CPT (Critical Pull Time) schedule; `wes-work-planning` publishes remaining
capacity per `(path, CPT)`; `order-management` derives a real delivery
promise from both. The obvious next question — *can we offer that
capability to an external retail network?* — turned out to have a
non-obvious answer.

**No operation in the network's API accepts a declaration of
capability.** Across the Selling Partner API's Vendor Direct Fulfillment
family there is nowhere to say "my cutoffs are 11:00 and 18:00, and my
pick path takes 95 minutes at p95"; lead times and operating hours are
Vendor Central configuration, not an API surface. Capability reaches a
network only through three signals, all of them *consequences*:

| Signal | Meaning |
| --- | --- |
| Inventory update | What we claim we can ship |
| Order acknowledgement | What we commit to — within 24h, whole order, fill-or-kill |
| Shipment confirmation | Whether we actually did |

The network infers our capability from the gap between the second and the
third. So the interesting decision is **what to advertise and what to
commit to** — and the fleet already owns every fact needed to decide both
well.

## The idea worth building (planned, not built)

Most integrations of this shape advertise physical stock on hand. This
fleet can do better, because it knows whether the building can actually
*move* those units before the next departure:

```
advertisedQuantity = min(
    physicalAvailable,                       inventory-storage
    throughputFeasibleBefore(nextCutoff)     process-path-management cycleTimeP95 + CPTSchedule
                                             × wes-work-planning remaining PathCapacity
)
```

400 units in the building but a path that can only carry 120 more before
the 18:00 cutoff means advertising 400 sells a promise the floor cannot
keep; advertising 120 sells capability honestly. [ADR 0001](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md)
names this **CapabilityOffer** and calls it "the feature" — and it is
**not built yet**. What exists today is the commitment half: receiving
demand and answering it honestly.

## What is built: answering demand honestly

Demand arrives by **polling** — the network offers no push. Every
`POLL_INTERVAL` (default `1m`) a poller asks the network gateway for new
demand and feeds each unit to `ReceiveNetworkDemand`, which:

1. **Translates** every line's network product id to one of our SKUs. One
   untranslatable product rejects the whole order — we cannot acknowledge
   in full what we cannot identify in full.
2. **Raises a held order** in `order-management` (`POST /orders` with
   `releaseOnAllocation: false`, `allowPartialShipment: false`, and the
   network's `requiredShipBy`). Held, because we must know whether we
   *can* fulfil before answering, and must not put work on the floor for
   demand we may still reject.
3. **Reads the verdict.** `order-management` answers with
   `PromisePolicy.FeasibleBy`: a returned `promiseDate` means the deadline
   is makeable; a null one means it is not. No promise math is done here.
4. **Answers and commits** — acknowledge and release
   (`POST /orders/{id}/release`), or reject and cancel
   (`DELETE /orders/{id}`), so reservations never outlive the decision.

A separate `SweepAcknowledgementDeadlines` ticker rejects any order still
unanswered past its 24-hour `acknowledgeBy` instant and cancels its held
local order, if any. Today all of this runs against a **stub** network
gateway seeded from `NETWORK_SEED_FILE`; no call to a real network is made
anywhere.

## Why this is its own context, not an adapter inside order-management

`order-management` is where orders live, so the pull to put the
integration there is real. ADR 0001 records four facts that make it the
wrong home, each individually sufficient:

1. **The relationship is Conformist.** The fleet has zero influence over
   the network's contract. Its vocabulary — purchase-order numbers, line
   sequence numbers, ASINs, acknowledgement codes, selling parties — cannot
   be negotiated, only translated, and translation needs a place to happen.
2. **Customer PII would cross the boundary for the first time.** Network
   orders carry ship-to name, address and phone. Putting that into the
   aggregate four other contexts already read would be the largest
   blast-radius change available. (PII is **not modelled yet**.)
3. **The acknowledgement clock is an external SLA.** Missing it is an
   external penalty, not an internal inconvenience; no other context in
   the fleet carries one.
4. **Advertised availability is not an order concept.** It spans
   inventory, path capability and live capacity, and exists whether or not
   any order does.

## Where the network's model collides with what the fleet shipped

Two collisions are resolved up front, jointly with the companion
[order-management ADR 0020](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md):

- **Fill-or-kill vs. per-shipment-group promising.** The network confirms
  or rejects a purchase order in its entirety; `order-management` ADR 0017
  promises line groups separately for ordinary customers. Network demand
  must therefore be ship-complete, which is why every held order is raised
  with `allowPartialShipment: false`.
- **Commit-before-work.** `order-management` normally receives, allocates
  and releases in one call, and its ADR 0004 makes release the
  cancellation boundary. ADR 0020 adds the `releaseOnAllocation` hold so a
  rejection stays on the correct side of that boundary.

See the [Bounded Context Canvas](/contexts/network-fulfillment/bounded-context-canvas)
for the full relationship picture.
