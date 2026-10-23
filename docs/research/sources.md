---
id: sources
title: Sources and evidence
sidebar_label: Sources and evidence
description: "Every source cited on the Research pages, with the sentences that support the claims."
---

# Sources and evidence

Generated from a citations ledger held privately, built with the
grounded-citations method: each quote was checked to appear verbatim in the
fetched page (or in the published JSON model for the seller-API schemas) before
it was accepted. Retrieved 2026-10-22.

Wording on this page is neutralised editorially: the operator's name is
replaced by `[the operator]` and its product and programme names by
`[the seller API]` or a bracketed description, and verbatim evidence is held
privately. Sources on the operator's own domains are listed by number, title,
type and retrieval date, without a link. Citation numbers are unchanged.

### [1] Operator's public facilities page

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> At sortation centers, associates sort customer orders by final destination and consolidate them onto trucks for faster delivery.

> [the operator]’s receive centers support customer fulfillment [by means of] taking in large orders of the types of inventory that we expect to quickly sell and allocating it to fulfillment centers within the network.

> In these buildings, customer orders are prepared for last-mile delivery to customers.


### [2] Regionalize and Scale: a large operator's fulfillment network design (INFORMS Journal on Applied Analytics, 2026)

[https://pubsonline.informs.org/doi/full/10.1287/inte.2025.0295](https://pubsonline.informs.org/doi/full/10.1287/inte.2025.0295)

> Internally, the promise is given based on an analysis of the network state, and verification that at least one feasible delivery path exists.

> The assigned FC and path at order assignment time may be different from the feasible path that was used to generate the customer promise, because the final FC assignment is an opportunity for [the operator] to optimize the network performance.

> The assigned path may change more than once until the item is picked in the FC, after which the path stays locked until delivery

> partitioned the country into eight interconnected but largely self-sufficient regions

> increased in-region fulfillment from 62% to 76%

> In our software systems, we made changes in how we manage inventory, generate customer promises, and assign orders to FCs.

> Following successful pilot and full network deployment by March 2023


### [3] Operator's research blog article on reworking its fulfillment network

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> As soon as a customer clicks the "buy now" button, [the operator]'s [transportation optimization service] assigns the optimal route for the purchased item.

> each region must carry the breadth of selection that customers expect

> eight largely self-sufficient regional networks, while retaining national coverage.


### [4] ORMS Today — IFORS Lecture: A Large Operator's Fulfillment Network: Topology and Capacity Planning

[https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full](https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full)

> The [the operator] fulfillment network is comprised of [the operator] buildings and transportation lanes among them.

> The lanes of this network are highly dynamic: their capacity can be changed a few days in advance

> the fulfillment and sortation centers are planned years in advance whereas delivery stations are only planned months in advance.

> In addition, [the operator] Air Gateway is also available

> The [the operator] operations supply chain network includes the inbound network – global vendors ([fulfillment programme] and retail), inbound cross dock and domestic vendors ([fulfillment programme] and retail) – and outbound network including middle mile (transport) to the fulfillment and sortation centers, to delivery stations and finally the last-mile destination.

> long-term planning is about 6+ months,  medium-term planning is three months and short-term planning is less than one month


### [5] Operator's research blog article on its middle-mile team

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> [the operator]’s Middle Mile team develops routing solutions to move customer orders from its vendors and fulfillment centers to its network of sortation centers, air facilities, and delivery stations in the most efficient way possible.


### [6] Operator's public update on its delivery service partner programme

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> While DSPs as independent businesses hire and manage their own employees, they receive support from [the operator] to help them be successful.


### [7] Operator's public article by its operations leadership on delivery speed

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> Across the top 60 largest U.S. metro areas, more than half of [paid delivery programme] member orders arrived the same or next day.

> Items shipped from nearby fulfillment centers or delivery stations helps packages get to customers not only faster, but also with fewer emissions.


### [8] Operator's published API documentation: supply-source (multi-location inventory) API

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> to manage the configurations and capabilities of seller [supply-source locations].


### [9] Operator's published API specification: supply-source (multi-location inventory) API model

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> The opening time, ISO 8601 formatted timestamp without date, HH:mm.

> The operational configuration of `[the seller API]`.

> The outbound capability of a supply source.


### [10] Operator's published API specification: shipping API v2 model

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> The time windows promised for pickup and delivery events.

> The ship date and time (the requested pickup). This defaults to the current date and time.


### [11] Operator's published API specification: outbound fulfillment API model (2020-07-01)

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> The earliest date that the shipment is expected to be sent from the fulfillment center, in ISO 8601 date time format.

> The timestamp at which a delivery offer expires.

> If an item in a fulfillment order is determined to be unfulfillable before any shipment in the order has acquired the status of Pending


### [12] Operator's published API specification: direct-fulfillment vendor orders API model (v1)

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> Time by which the vendor is required to ship the order.

> Delivery date promised to the [the operator] customer.

> Status for orders accepted by vendors.


### [13] Operator's published API documentation: direct-fulfillment vendor workflow guide

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> Integrating with the Direct Fulfillment APIs starts with the vendor pulling the orders for fulfillment using the

> You must acknowledge an order before you submit a shipping label request.

> This is a restricted operation and requires a Restricted Data Token (RDT) for authorization.


### [14] Operator's published API documentation: dynamic delivery offers guide

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> Items that cannot be delivered at a requested tier return an empty `offers` array and a `constraints` array explaining why


### [15] Operator's published API reference: delivery offers operation

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> A list of delivery offers, including offer expiration, earliest and latest date and time range, and the delivery offer policy.


### [16] Operator's published API reference: fulfillment preview operation

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> A list of fulfillment order previews, including estimated shipping weights, estima


### [17] Operator's published API changelog: external fulfillment APIs (v2024-09-11)

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> These APIs allow programmatic handling of inventory, returns, and shipping across multiple external fulfillment channels, including [four named seller fulfilment programmes].


### [18] Operator's published API reference: handover slots operation of a seller shipping programme

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> A time window to hand over an [seller programme] package to [the operator] Logistics.


### [19] Operator's published API reference: inbound placement options operation

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> Contains information pertaining to the placement of the contents of an inbound plan and the related costs.


### [20] Operator's published API samples discussion: managing handling time

Retrieved 2026-10-22. No link: the source is on a domain of the operator.

> it’s the number of business days a seller takes to pick, pack and ship a **[merchant-fulfilled programme]** order after receiving it.


### [21] Google Merchant Center — Set up estimated delivery time

[https://support.google.com/merchants/answer/14949917?hl=en](https://support.google.com/merchants/answer/14949917?hl=en)

> To calculate overall delivery time, you need to specify cut-off time, handling time, and transit time.

> This calculation is based on business days and takes your order cut-off time into account.

> We calculate this value as “maximum handling days + maximum transit days”.

> If an order's handling or transit time overlaps with a holiday, Google adds an extra day to the estimated delivery date.


### [22] Google Merchant API — Overview of shipping settings

[https://developers.google.com/merchant/api/guides/shipping-settings/overview](https://developers.google.com/merchant/api/guides/shipping-settings/overview)

> Warehouse information can be managed by including a `warehouses` section in your `shippingsettings` resource, allowing you to specify details like address, handling time, and business days.


### [23] Google Merchant Center — Handling cutoff time

[https://support.google.com/merchants/answer/16543665?hl=en](https://support.google.com/merchants/answer/16543665?hl=en)

> attribute to specify the latest time an order can be placed to still be processed on the same day.


### [24] Walmart Marketplace — Update fulfillment lag time

[https://marketplacelearn.walmart.com/guides/Shipping%20&%20fulfillment/Fulfillment%20settings/Update-fulfillment-lag-time-in-Seller-Center](https://marketplacelearn.walmart.com/guides/Shipping%20&%20fulfillment/Fulfillment%20settings/Update-fulfillment-lag-time-in-Seller-Center)

> Fulfillment lag time is the number of days it takes you to prepare an item for shipment.

> Walmart Marketplace requires you to ship orders within two operational days

> unless you’ve submitted a


### [25] Walmart Marketplace API — Update item inventory per ship node

[https://developer.walmart.com/us-marketplace/reference/updatemultinodeinventory](https://developer.walmart.com/us-marketplace/reference/updatemultinodeinventory)

> The unique alphanumeric ID you assign to an item.

> Update item inventory per ship node


### [26] Shopify Admin GraphQL — DeliveryPromiseProvider

[https://shopify.dev/docs/api/admin-graphql/2026-10/objects/DeliveryPromiseProvider](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/DeliveryPromiseProvider)

> The time zone to be used for interpreting day of week and cutoff times in delivery schedules when looking up delivery promises.

> A delivery promise provider. Currently restricted to select approved delivery promise partners.

> The location associated with this delivery promise provider.


### [27] Shopify Admin GraphQL — FulfillmentOrder

[https://shopify.dev/docs/api/admin-graphql/latest/objects/FulfillmentOrder](https://shopify.dev/docs/api/admin-graphql/latest/objects/FulfillmentOrder)

> Once the order routing process is complete, one or more fulfillment orders will be created and assigned to these locations.

> the order routing process which determines which locations will be responsible for fulfilling the purchased items.


### [28] IBM Sterling Intelligent Promising — Promising

[https://www.ibm.com/products/intelligent-promising/promising](https://www.ibm.com/products/intelligent-promising/promising)

> Inventory promising is no longer just about providing delivery estimates.


### [29] Manhattan Active Order Management — Precise Order Promising

[https://www.manh.com/solutions/omnichannel-software-solutions/order-management-system/precise-order-promising](https://www.manh.com/solutions/omnichannel-software-solutions/order-management-system/precise-order-promising)

> Precise order promises help retailers move from static day range promises (e.g., 5 to 7 days) to personalized and exact dates

> refining order promises while considering the operational capabilities of a retailer’s supply chain.


### [30] Oracle Order Management — Promising rules and sourcing rules

[https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26c/faiom/set-up-promising-rules-and-sourcing-rules-for-order-management.html](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26c/faiom/set-up-promising-rules-and-sourcing-rules-for-order-management.html)

> Use an available-to-promise (ATP) rule and a sourcing rule to promise your sales o

> You create a sourcing rule that specifies the [sources of supply] to consider when promising


### [31] MIT thesis — Optimization of delivery promise policy to control peak demand on a fulfillment network

[https://dspace.mit.edu/handle/1721.1/122587](https://dspace.mit.edu/handle/1721.1/122587)

> Delivery promise policy establishes daily deadlines by which orders must be placed to be eligible for a two-day promise.

> This paper presents a methodology for using the promise policy to control the rate of new workable demand (NWD) arrival to the fulfillment network during a peak period.

