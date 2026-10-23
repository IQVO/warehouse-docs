---
id: marketplace-api-surface-map
title: Marketplace API surface map
sidebar_label: Marketplace API surface map
description: "Which surfaces of a large operator's seller APIs (and its shipping API) describe nodes, capability and promises, what their published schemas actually contain, and which retail-network context models the same idea."
---

# Marketplace API surface map

The operator's seller APIs are the public face of its network
towards sellers and vendors. It cannot show the network's internals, but its
schemas show which concepts the network exposes, what it asks partners to
declare, and how it phrases a promise. Facts below cite the API documentation
or the operator's published JSON models of those APIs; the
right-hand column is this site's model and carries no citation.

## Nodes and declared capability

The supply-source (multi-location inventory) API exists to manage the configurations and capabilities of
seller supply-source locations.[8] In its published model, a supply source's
operational configuration holds contact details, a throughput configuration,
operating hours by day and a handling time.[9] Opening and closing times are
`HH:mm` strings without a date.[9] The throughput cap is a value per time unit,
and the only throughput unit in the schema is `Order`.[9] A supply source has a
time zone and a status of `Active`, `Inactive` or `Archived`.[9] Its outbound
capability carries an `isSupported` flag, an operational configuration, a
return location, and delivery and pickup channels.[9]

| Seller-API concept | Published shape | retail-network model |
| --- | --- | --- |
| Supply source | id, seller code, alias, address, status, configuration, capabilities[9] | `Node` with `VendorRef{vendorId, vendorNodeCode}` in `node-topology` |
| `OperationalConfiguration` | `handlingTime`, `operatingHoursByDay`, `throughputConfig{throughputCap, throughputUnit}`[9] | `OperationalProfile` (adds `cutoffs[]`, `holidays[]`, `profileRevision`) |
| `OutboundCapability.returnLocation` | a return location on the outbound capability[9] | a `RETURNS_CENTER` node |
| Supply source status | `Active`, `Inactive`, `Archived`[9] | `ACTIVE`, `SUSPENDED`, `RETIRED` |

Handling time also exists per listing: it is the number of business days a
seller takes to pick, pack and ship a merchant-fulfilled order, and is set
through the listing attribute `lead_time_to_ship_max_days`.[20]

:::warning[Correction to an earlier fleet finding]
The warehouse-systems fleet recorded that "no operation of the operator's vendor API accepts a
declaration of capability", and `network-fulfillment`'s
`NetworkGateway.DeclareCapability` is a documented no-op for that reason. That
holds for the direct-fulfillment vendor API, which the fleet studied. It does not hold
for sellers using multi-location inventory: the supply-source API accepts a
declared handling time, operating hours and an order throughput cap per supply
source.[8][9] This site's model keeps "declared + measured" (ADR 0003) and now
has a real-world precedent for the declared half. See
[Fleet changes](/integration/fleet-changes).
:::

## Demand to a vendor node

In the direct-fulfillment vendor workflow the vendor pulls orders with the Orders API, sends
an acknowledgement, prints a label with `createShippingLabels`, ships, then
sends a shipment confirmation.[13] An order must be acknowledged before a label
can be requested.[13] Getting the orders list is a restricted operation that
requires a Restricted Data Token because it contains customer PII.[13] The
published order carries `shipmentDates.requiredShipDate`, the time by which the
vendor must ship, and `promisedDeliveryDate`, the date promised to the
customer.[12] Its status values are `NEW`, `SHIPPED`, `ACCEPTED` and
`CANCELLED`.[12]

| Seller-API concept | Published shape | retail-network model |
| --- | --- | --- |
| DF purchase order | `purchaseOrderNumber`, `orderDetails.shipmentDates{requiredShipDate, promisedDeliveryDate}`[12] | `PurchaseOrder{poNumber, requiredShipBy, ackBy}` in `vendor-connectivity` (deliverBy stays in the network) |
| Poll then acknowledge | pull orders, then acknowledge[13] | `GET /vendor/purchase-orders` with `nextToken`, then `POST /vendor/acknowledgements` |
| Label only after acknowledgement | acknowledge before a label request[13] | invariant `ErrLabelBeforeAcceptance` |
| PII behind a Restricted Data Token | customer PII in DF orders[13] | **no** ship-to in the Vendor API at all ([ADR 0006](/adr/0006-pii-confinement)) |

The operator's external-fulfillment APIs (inventory, returns, shipping) handle several
seller-operated fulfillment channels, four of them named programmes.[17] One of
those programmes exposes handover slots: time windows
to hand a package over to the operator's logistics arm.[18]

**Model reading.** A handover slot is a pickup departure at a vendor node's
cutoff (`linehaul-transportation`, policy `PickupFromCutoffs`).

## How a promise is phrased

| Surface | What its schema says | retail-network model |
| --- | --- | --- |
| Shipping API v2 `Rate.promise` | "The time windows promised for pickup and delivery events": a `pickupWindow` and a `deliveryWindow`, each `{start, end}`.[10] The requested pickup defaults to now.[10] | `Promise` = ship-by at the node + deliver-by window |
| Fulfillment Outbound `getFulfillmentPreview` | per shipment, `earliestShipDate`, `latestShipDate`, `earliestArrivalDate`, `latestArrivalDate`;[11] speeds `Standard`, `Expedited`, `Priority`, `ScheduledDelivery`[11] | `DeliveryOffer` per `Tier` (`SAME_DAY`, `NEXT_DAY`, `TWO_DAY`, `STANDARD`) |
| Fulfillment Outbound `getDeliveryOffers` | offers with an expiry, an earliest/latest date range and a policy message;[15] a delivery offer has `expiresAt`[11] | `DeliveryOffer.expiresAt` (invariant `ErrOfferExpiryTooLate`) |
| Dynamic delivery offers (`getOffers`) | an item that cannot be delivered at a tier returns no offer and a `constraints` array explaining why, for example `DeliverySLAUnavailable` or `ItemQuantityNotAvailable`[14] | `OfferConstraint`: `DELIVERY_SLA_UNAVAILABLE`, `ITEM_QUANTITY_NOT_AVAILABLE`, ... |
| `FulfillmentPolicy` | `FillOrKill`: if an item is unfulfillable before any shipment is Pending, the whole order is unfulfillable[11] | fill-or-kill acknowledgement (`ErrPartialAcknowledgement`) |

## Placing inventory

The inbound shipment API (v2024-03-20) returns placement options for an inbound plan,
each with its placement costs.[19]

**Model reading.** Placement is the future `inventory-placement` context. It is
out of scope here because fulfillment nodes are vendor-operated and vendors
place their own stock (the fleet's `network-inventory-planning`).

## Sources

Every number above maps to one source. The verbatim sentences that support each claim are on [Sources and evidence](/research/sources).

- **[8]** Operator's published API documentation: supply-source (multi-location inventory) API (no link)
- **[9]** Operator's published API specification: supply-source (multi-location inventory) API model (no link)
- **[10]** Operator's published API specification: shipping API v2 model (no link)
- **[11]** Operator's published API specification: outbound fulfillment API model (2020-07-01) (no link)
- **[12]** Operator's published API specification: direct-fulfillment vendor orders API model (v1) (no link)
- **[13]** Operator's published API documentation: direct-fulfillment vendor workflow guide (no link)
- **[14]** Operator's published API documentation: dynamic delivery offers guide (no link)
- **[15]** Operator's published API reference: delivery offers operation (no link)
- **[17]** Operator's published API changelog: external fulfillment APIs (v2024-09-11) (no link)
- **[18]** Operator's published API reference: handover slots operation of a seller shipping programme (no link)
- **[19]** Operator's published API reference: inbound placement options operation (no link)
- **[20]** Operator's published API samples discussion: managing handling time (no link)
