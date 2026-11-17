---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the network needs a returns front door, who uses it, the decisions it makes, and what it deliberately leaves out."
---

# Business Context

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

## The problem

Until this context the model ended at the doorstep. A shopper who wanted to
send a delivered group back had nowhere to ask, nothing decided where the
goods should go, and the units that came back sellable never reached a
listing again. The model named `customer-returns` a future context; network
[ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context) made it
the twelfth.

Three things make a return more than a reversed delivery. Some returns are
not worth moving: below a value threshold it is cheaper to let the shopper
keep the goods. The goods that do move need a destination the shopper cannot
choose and a label whose address this context must never see. And what
arrives has to be graded before any of it is offered for sale again.

Everything on this page is **this model** (built by the `customer-returns`
service), not a claim about any operator.

**Customer Returns** answers: *may this group be returned, what happens to
the goods, and what came back sellable?*

## Actors

| Actor | What they do with this context |
| --- | --- |
| A shopper, through the storefront | Authorizes the return of a shipped or delivered order group, asks for a reverse label per package, reads the authorization back, cancels it. The storefront is the only caller and the only price knower. |
| `customer-ordering` | Upstream facts: the placed groups with their destination postal prefix and lines, and the decided notices that say a group is shipped, delivered, lost or returned. |
| `node-topology` | Upstream facts: which returns centres exist and are `ACTIVE`, and which region a postal prefix belongs to. |
| `order-sourcing` | Upstream facts: which node fulfilled the group and whose stock each line took. |
| `offer-availability` | Downstream: raises the owner listing's available quantity from `ReturnCompleted`. |
| `shipping-and-tracking` | Issues the reverse label. Decided in that service's ADR 0017; the route is not in its `develop` contract yet, so the model draws no call. |
| `vendor-connectivity` and the vendor's returns centre | Would learn of the authorization as a return advice and answer with the graded outcome. Decided in that service's ADR 0014; not in its `develop` contracts yet, so the model draws no edge. |

## Decisions it makes

1. **The disposition is decided here, never by the caller.** A pure function
   over the lines' caller-declared prices, the method, the region's `ACTIVE`
   returns centre and the group's origin node: `KEEP`, else
   `NEAREST_RETURNS_CENTER`, else `ORIGIN_NODE`, else the authorization is
   refused (`ErrNoReturnDestination`).
2. **Returnless below a threshold.** `KEEP` is chosen when the method is not
   `PICKUP`, every line has a price and the declared total is at most 1500
   cents. It closes at once: no destination, no label, no movement.
3. **Only a shipped or delivered group is returnable.** The check reads the
   local `OrderGroupView`; a group that is still promised, or that the view
   does not know yet, is refused (`ErrGroupNotShipped`) and the shopper
   retries with the same `Idempotency-Key`.
4. **Prices are the caller's facts.** `unitPriceCents` is stored for the
   decision and echoed on the REST view. It is on no event. A line without a
   price makes `KEEP` impossible.
5. **No address, no name, no phone, no free text.** The reason is an enum.
   The context keeps the postal prefix of the group's destination; the
   ship-to stays where it is.
6. **An authorization expires after 30 days**, checked on the next touch.
   There is no sweeper.
7. **At most five packages per authorization**, one reverse label each.
8. **The first graded outcome that fits completes the return.** Lines the
   authorization never covered are recorded as facts, never published and
   never restocked.

## Deliberately out of scope

- **Money.** Refunds belong to the storefront and its payments context.
  Network ADR 0012 speaks of fees as facts; the built service carries no fee,
  refund or settlement field.
- **The ship-to and the label document.** The label is issued by
  `shipping-and-tracking`; this context keeps a tracking number and a
  destination node id.
- **Grading.** Receipt, inspection and per-unit disposition happen in the
  vendor's returns centre. The network disposition is an input there, never
  re-decided.
- **Stock.** `offer-availability` adjusts listings from the restock fact.
- **The doorstep pickup leg.** `PICKUP` is accepted with its window and
  published, and `last-mile-delivery` ships a dormant pickup induction kind,
  but nothing connects the two yet.
- **Exchanges, partial-quantity returns of a line and return shipping
  charges.** The contract has none of them: a returned line is the whole
  quantity placed on that order line.
