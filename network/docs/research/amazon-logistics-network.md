---
id: amazon-logistics-network
title: The Amazon logistics network
sidebar_label: Amazon logistics network
description: "What is publicly documented about how Amazon's fulfillment and transportation network is shaped and how it promises a delivery date, with a citation on every claim."
---

# The Amazon logistics network

This page holds **facts only**: what Amazon and peer-reviewed or trade sources
have published. Every sentence that states a fact carries a numbered citation;
the list at the bottom maps each number to its source and the verbatim
sentence that supports it. The model this site proposes starts at
[Domain Vision](/network/strategic-design/domain-vision); where this page draws a
conclusion for the model, the paragraph is headed **Model reading** and carries
no citation.

## A network of buildings and lanes

Amazon describes its fulfillment network as buildings plus the transportation
lanes among them.[4] A public lecture by an Amazon principal research
scientist modelled it as nodes for fulfillment centres, sortation centres and
delivery stations, linked by truck and air lanes, and noted that an Amazon Air
Gateway is part of it.[4] The same lecture split the network into an inbound
side (global and domestic vendors and inbound cross docks) and an outbound side
(middle mile to fulfillment and sortation centres, to delivery stations, to the
last-mile destination).[4]

| Building | What Amazon says it does |
| --- | --- |
| Sortable fulfillment centre | Employees pick, pack and ship customer orders such as books, toys and housewares, often alongside robots.[1] |
| Non-sortable fulfillment centre | Picks, packs and ships bulky or large items.[1] |
| Receive centre | Takes in large inbound orders of fast-selling inventory and allocates it to fulfillment centres in the network.[1] |
| Inbound cross dock | Part of the inbound network between vendors and fulfillment centres.[4] |
| Sortation centre | Sorts customer orders by final destination and consolidates them onto trucks.[1] |
| Delivery station | Prepares customer orders for last-mile delivery.[1] |
| Air gateway | Connects the ground network to air lanes.[4] |

The Middle Mile team routes customer orders from vendors and fulfillment
centres to sortation centres, air facilities and delivery stations.[5] The
last mile is largely run by Delivery Service Partners: independent businesses
that hire and manage their own employees with support from Amazon.[6]

**Model reading.** The network has two very different kinds of node:
inventory-holding nodes that pick and pack, and parcel nodes that only sort and
move packages. That split is the first decision on
[Node model](/network/network-model/node-model).

## Different parts change at different speeds

Fulfillment and sortation centres are planned years in advance, delivery
stations only months in advance.[4] Lane capacity is highly dynamic and can be
changed a few days in advance.[4] Truck-lane planning runs at three horizons:
about six months or more, about three months, and under one month.[4]

**Model reading.** Node existence, lane schedules and delivery-wave capacity
change at different cadences, so they belong to different models:
`node-topology` (years/months), `linehaul-transportation` (days) and
`last-mile-delivery` (hours).

## Regionalization

Amazon partitioned its US network into eight interconnected but largely
self-sufficient regions, fully deployed by March 2023.[2] Amazon Science describes the result as
eight largely self-sufficient regional networks that keep national
coverage.[3] In-region fulfillment rose from 62% to 76%.[2] A design
constraint was that each region must carry the breadth of selection customers
expect.[3] Amazon Science also states that when a customer clicks "buy now",
its Adaptive TRansportation OPtimization Service (ATROPS) assigns the route for
the purchased item.[3] Amazon's operations leadership reports that more than
half of Prime member orders in the 60 largest US metro areas arrived the same
or next day, and attributes part of that to shipping from nearby fulfillment
centres or delivery stations.[7]

**Model reading.** A region is a first-class concept of the topology, and the
promise and sourcing policies prefer in-region nodes.

## The promise is not the assignment

This is the published fact the whole model rests on. The INFORMS paper on
regionalization explains that at the moment a customer is deciding whether to
buy, Amazon shows a promise: the deadline by which the item will be delivered
if bought now.[2] Internally, that promise is based on an analysis of the
network state and a check that at least one feasible delivery path
exists.[2] After purchase, items wait in a virtual queue and are later
assigned to specific fulfillment centres and paths ("order
assignment").[2] The assigned centre and path may differ from the feasible
path that produced the promise, because final assignment is an opportunity to
optimize network performance.[2] The assigned path may change more than once
until the item is picked; after that it stays locked until delivery.[2] The
paper lists generating customer promises and assigning orders to fulfillment
centres as separate software changes that regionalization required.[2]

**Model reading.** Two bounded contexts, not one:
`delivery-promise` proves feasibility with a **witness path** and holds
capacity; `order-sourcing` keeps the group in a virtual queue, re-optimizes
until release, and locks the path at commitment. See
[ADR 0002](/network/adr/0002-promise-and-assignment-are-separate).

## The promise policy also shapes demand

An MIT thesis on a fulfillment network describes a delivery promise policy that sets daily deadlines by which orders
must be placed to be eligible for a two-day promise.[31] It presents a method
for using that policy to control how fast new workable demand reaches the
fulfillment network during a peak period.[31]

**Model reading.** The promise context owns a policy-versioned order deadline
per tier and region (`TierOrderDeadline`), not just a calculator.

## What is not public

No source found describes Amazon's promise algorithm in detail, the internal
names of its promise or sourcing services beyond ATROPS, how delivery-station
wave capacity is published internally, or how vendor scorecards feed promise
dates. Those parts of the model are this site's proposal, labelled as such on
every page that uses them.

## Sources

Every number above maps to one source. The verbatim sentences that support each claim are on [Sources and evidence](/network/research/sources).

- **[1]** [Amazon — Our Facilities](https://www.aboutamazon.com/workplace/facilities)
- **[2]** [Regionalize and Scale: Amazon’s Fulfillment Network Design (INFORMS Journal on Applied Analytics, 2026)](https://pubsonline.informs.org/doi/full/10.1287/inte.2025.0295)
- **[3]** [Amazon Science — How Amazon reworked its fulfillment network](https://www.amazon.science/news-and-features/how-amazon-reworked-its-fulfillment-network-to-meet-customer-demand)
- **[4]** [ORMS Today — IFORS Lecture: The Amazon Fulfillment Network: Topology and Capacity Planning](https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full)
- **[5]** [Amazon Science — How Amazon's Middle Mile team helps packages](https://amazon.science/latest-news/how-amazons-middle-mile-team-helps-packages-make-the-journey-to-your-doorstep)
- **[6]** [About Amazon — Delivery Service Partner program](https://www.aboutamazon.com/news/policy-news-views/amazon-dsp-program-update)
- **[7]** [About Amazon — Doug Herrington on delivery speed](https://www.aboutamazon.com/news/operations/doug-herrington-amazon-prime-delivery-speed)
- **[31]** [MIT thesis — Optimization of delivery promise policy to control peak demand on a fulfillment network](https://dspace.mit.edu/handle/1721.1/122587)
