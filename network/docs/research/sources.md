---
id: sources
title: Sources and evidence
sidebar_label: Sources and evidence
description: "Every source cited on the Research pages, with the verbatim sentences that support the claims."
---

# Sources and evidence

Generated from `research/citations-ledger.json` with the grounded-citations
ledger: each quote was checked to appear verbatim in the fetched page (or in
the published JSON model for the SP-API schemas) before it was accepted.
Retrieved 2026-10-22.

### [1] Amazon — Our Facilities

[https://www.aboutamazon.com/workplace/facilities](https://www.aboutamazon.com/workplace/facilities)

> At sortation centers, associates sort customer orders by final destination and consolidate them onto trucks for faster delivery.

> Amazon’s receive centers support customer fulfillment by taking in large orders of the types of inventory that we expect to quickly sell and allocating it to fulfillment centers within the network.

> In these buildings, customer orders are prepared for last-mile delivery to customers.


### [2] Regionalize and Scale: Amazon’s Fulfillment Network Design (INFORMS Journal on Applied Analytics, 2026)

[https://pubsonline.informs.org/doi/full/10.1287/inte.2025.0295](https://pubsonline.informs.org/doi/full/10.1287/inte.2025.0295)

> Internally, the promise is given based on an analysis of the network state, and verification that at least one feasible delivery path exists.

> The assigned FC and path at order assignment time may be different from the feasible path that was used to generate the customer promise, because the final FC assignment is an opportunity for Amazon to optimize the network performance.

> The assigned path may change more than once until the item is picked in the FC, after which the path stays locked until delivery

> partitioned the country into eight interconnected but largely self-sufficient regions

> increased in-region fulfillment from 62% to 76%

> In our software systems, we made changes in how we manage inventory, generate customer promises, and assign orders to FCs.

> Following successful pilot and full network deployment by March 2023


### [3] Amazon Science — How Amazon reworked its fulfillment network

[https://www.amazon.science/news-and-features/how-amazon-reworked-its-fulfillment-network-to-meet-customer-demand](https://www.amazon.science/news-and-features/how-amazon-reworked-its-fulfillment-network-to-meet-customer-demand)

> As soon as a customer clicks the "buy now" button, Amazon's Adaptive TRansportation OPtimization Service (ATROPS) assigns the optimal route for the purchased item.

> each region must carry the breadth of selection that customers expect

> eight largely self-sufficient regional networks, while retaining national coverage.


### [4] ORMS Today — IFORS Lecture: The Amazon Fulfillment Network: Topology and Capacity Planning

[https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full](https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full)

> The Amazon fulfillment network is comprised of Amazon buildings and transportation lanes among them.

> The lanes of this network are highly dynamic: their capacity can be changed a few days in advance

> the fulfillment and sortation centers are planned years in advance whereas delivery stations are only planned months in advance.

> In addition, Amazon Air Gateway is also available

> The Amazon operations supply chain network includes the inbound network – global vendors (FBA and retail), inbound cross dock and domestic vendors (FBA and retail) – and outbound network including middle mile (transport) to the fulfillment and sortation centers, to delivery stations and finally the last-mile destination.

> long-term planning is about 6+ months,  medium-term planning is three months and short-term planning is less than one month


### [5] Amazon Science — How Amazon's Middle Mile team helps packages

[https://amazon.science/latest-news/how-amazons-middle-mile-team-helps-packages-make-the-journey-to-your-doorstep](https://amazon.science/latest-news/how-amazons-middle-mile-team-helps-packages-make-the-journey-to-your-doorstep)

> Amazon Transportation Services’ Middle Mile team develops routing solutions to move customer orders from its vendors and fulfillment centers to its network of sortation centers, air facilities, and delivery stations in the most efficient way possible.


### [6] About Amazon — Delivery Service Partner program

[https://www.aboutamazon.com/news/policy-news-views/amazon-dsp-program-update](https://www.aboutamazon.com/news/policy-news-views/amazon-dsp-program-update)

> While DSPs as independent businesses hire and manage their own employees, they receive support from Amazon to help them be successful.


### [7] About Amazon — Doug Herrington on delivery speed

[https://www.aboutamazon.com/news/operations/doug-herrington-amazon-prime-delivery-speed](https://www.aboutamazon.com/news/operations/doug-herrington-amazon-prime-delivery-speed)

> Across the top 60 largest U.S. metro areas, more than half of Prime member orders arrived the same or next day.

> Items shipped from nearby fulfillment centers or delivery stations helps packages get to customers not only faster, but also with fewer emissions.


### [8] SP-API — Supply Sources API

[https://developer-docs.amazon/sp-api/docs/supply-sources-api](https://developer-docs.amazon/sp-api/docs/supply-sources-api)

> to manage the configurations and capabilities of seller supply sources.


### [9] SP-API model — supplySources_2020-07-01.json

[https://github.com/amzn/selling-partner-api-models/blob/main/models/supply-sources-api-model/supplySources_2020-07-01.json](https://github.com/amzn/selling-partner-api-models/blob/main/models/supply-sources-api-model/supplySources_2020-07-01.json)

> The opening time, ISO 8601 formatted timestamp without date, HH:mm.

> The operational configuration of `supplySources`.

> The outbound capability of a supply source.


### [10] SP-API model — Amazon Shipping API v2 (shippingV2.json)

[https://github.com/amzn/selling-partner-api-models/blob/main/models/shipping-api-model/shippingV2.json](https://github.com/amzn/selling-partner-api-models/blob/main/models/shipping-api-model/shippingV2.json)

> The time windows promised for pickup and delivery events.

> The ship date and time (the requested pickup). This defaults to the current date and time.


### [11] SP-API model — Fulfillment Outbound 2020-07-01

[https://github.com/amzn/selling-partner-api-models/blob/main/models/fulfillment-outbound-api-model/fulfillmentOutbound_2020-07-01.json](https://github.com/amzn/selling-partner-api-models/blob/main/models/fulfillment-outbound-api-model/fulfillmentOutbound_2020-07-01.json)

> The earliest date that the shipment is expected to be sent from the fulfillment center, in ISO 8601 date time format.

> The timestamp at which a delivery offer expires.

> If an item in a fulfillment order is determined to be unfulfillable before any shipment in the order has acquired the status of Pending


### [12] SP-API model — Vendor Direct Fulfillment Orders v1

[https://github.com/amzn/selling-partner-api-models/blob/main/models/vendor-direct-fulfillment-orders-api-model/vendorDirectFulfillmentOrdersV1.json](https://github.com/amzn/selling-partner-api-models/blob/main/models/vendor-direct-fulfillment-orders-api-model/vendorDirectFulfillmentOrdersV1.json)

> Time by which the vendor is required to ship the order.

> Delivery date promised to the Amazon customer.

> Status for orders accepted by vendors.


### [13] SP-API — Vendor Direct Fulfillment Workflow Guide

[https://developer-docs.amazon/sp-api/docs/vendor-df-workflow-guide](https://developer-docs.amazon/sp-api/docs/vendor-df-workflow-guide)

> Integrating with the Direct Fulfillment APIs starts with the vendor pulling the orders for fulfillment using the

> You must acknowledge an order before you submit a shipping label request.

> This is a restricted operation and requires a Restricted Data Token (RDT) for authorization.


### [14] SP-API — Get dynamic delivery offers

[https://developer-docs.amazon/sp-api/docs/get-dynamic-delivery-offers](https://developer-docs.amazon/sp-api/docs/get-dynamic-delivery-offers)

> Items that cannot be delivered at a requested tier return an empty `offers` array and a `constraints` array explaining why


### [15] SP-API — getDeliveryOffers

[https://developer-docs.amazon/sp-api/reference/deliveryoffers](https://developer-docs.amazon/sp-api/reference/deliveryoffers)

> A list of delivery offers, including offer expiration, earliest and latest date and time range, and the delivery offer policy.


### [16] SP-API — getFulfillmentPreview

[https://developer-docs.amazon.com/sp-api/reference/getfulfillmentpreview](https://developer-docs.amazon.com/sp-api/reference/getfulfillmentpreview)

> A list of fulfillment order previews, including estimated shipping weights, estima


### [17] SP-API — External Fulfillment APIs v2024-09-11

[https://developer-docs.amazon.com/sp-api/changelog/new-introducing-the-external-fulfillment-apis-v2024-09-11](https://developer-docs.amazon.com/sp-api/changelog/new-introducing-the-external-fulfillment-apis-v2024-09-11)

> These APIs allow programmatic handling of inventory, returns, and shipping across multiple external fulfillment channels, including Seller Flex, Easy Ship, Self Ship, and MFN Self Delivery.


### [18] SP-API — Easy Ship listHandoverSlots

[https://developer-docs.amazon.com/sp-api/reference/listhandoverslots](https://developer-docs.amazon.com/sp-api/reference/listhandoverslots)

> A time window to hand over an Easy Ship package to Amazon Logistics.


### [19] SP-API — Fulfillment Inbound listPlacementOptions

[https://developer-docs.amazon/sp-api/lang-ja_JP/reference/listplacementoptions](https://developer-docs.amazon/sp-api/lang-ja_JP/reference/listplacementoptions)

> Contains information pertaining to the placement of the contents of an inbound plan and the related costs.


### [20] SP-API samples — Managing Handling Time on Amazon

[https://github.com/amzn/selling-partner-api-samples/discussions/124](https://github.com/amzn/selling-partner-api-samples/discussions/124)

> it’s the number of business days a seller takes to pick, pack and ship a **Merchant Fulfilled Network (MFN)** order after receiving it.


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

> You create a sourcing rule that specifies the supply sources to consider when promising


### [31] MIT thesis — Optimization of delivery promise policy to control peak demand on a fulfillment network

[https://dspace.mit.edu/handle/1721.1/122587](https://dspace.mit.edu/handle/1721.1/122587)

> Delivery promise policy establishes daily deadlines by which orders must be placed to be eligible for a two-day promise.

> This paper presents a methodology for using the promise policy to control the rate of new workable demand (NWD) arrival to the fulfillment network during a peak period.

