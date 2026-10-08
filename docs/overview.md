---
id: overview
title: Overview
sidebar_label: Overview
description: What warehouse-docs is, how it is generated, and how to navigate it.
slug: /overview
---

# warehouse-systems documentation

This site is the fleet-wide reference for the **warehouse-systems**
ecosystem. The ecosystem is thirteen independently deployable Go services
with hexagonal architecture that together implement a warehouse fulfillment
platform: twelve domain bounded contexts plus `warehouse-ops-agent`. Each
service has its own REST and MCP surface. The twelve domain contexts own a
Postgres database and publish Kafka events. `warehouse-ops-agent` is the
exception: a thin read-side agent with no database and no Kafka. This site
documents eleven of the domain contexts and the agent;
`network-inventory-planning` (created 2026-10-06) is not aggregated here yet.

No single repository's docs site can show the **strategic** picture: the
context map, the core-domain classification, the shared ubiquitous language,
and the message flows that cross context boundaries. Each context's own
repository still owns and publishes its own docs site, with its ADRs,
detailed tactical design and run-locally guide. This site gathers those
artifacts, links them together, and adds the fleet-level strategic layer.

All source repositories live in the [IQVO](https://github.com/IQVO) GitHub
organization.

## The twelve contexts on this site

| Context | Classification | CloudEvents subdomain |
| --- | --- | --- |
| [`order-management`](/contexts/order-management) | Generic/Supporting | `wes` |
| [`inventory-storage`](/contexts/inventory-storage) | Core | `wms` |
| [`wes-work-planning`](/contexts/wes-work-planning) | Core | `wes` |
| [`fulfillment-execution`](/contexts/fulfillment-execution) | Core | `wes` |
| [`warehouse-planning`](/contexts/warehouse-planning) | Core | `wes` |
| [`workforce-management`](/contexts/workforce-management) | Supporting | `wes` |
| [`labor-performance`](/contexts/labor-performance) | Supporting | `wes` |
| [`warehouse-ops-agent`](/contexts/warehouse-ops-agent) | Supporting | `wes` |
| [`network-fulfillment`](/contexts/network-fulfillment) | Supporting | `wes` |
| [`facility-layout`](/contexts/facility-layout) | Generic | `wms` |
| [`process-path-management`](/contexts/process-path-management) | Generic | `wes` |
| [`product-master`](/contexts/product-master) | Supporting | `wms` |

The newest context on this site, `product-master`, is the single source of
truth for what a SKU is: its handling classification (taken over from
`inventory-storage`) and its physical profile. `warehouse-planning` answers
whether the warehouse can process the demand assigned to it. `network-fulfillment` is the
anti-corruption layer to an external retail fulfillment network. The
[Subdomain Classification](/strategic-design/subdomain-classification) and
[Core Domain Chart](/strategic-design/core-domain-chart) pages give the
reasoning behind each classification.

## Fleet-wide rules

- **CloudEvents 1.0, structured content mode, on every Kafka message.** This
  applies to the integration topics (`warehouse.<ctx>.events`) and the analytics
  topics (`warehouse.<ctx>.analytics`) alike. Every message carries the Kafka
  header `content-type: application/cloudevents+json; charset=UTF-8`, and
  `type` is `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`.
  Consumers dispatch on the full `type`, ignore unknown types, dedupe on
  `id`, and dead-letter or skip anything that fails CloudEvents validation.
  All contexts share one Kafka broker. The
  [Event Standard](/strategic-design/event-standard-cloudevents) page has the
  full rule.
- **REST and MCP are unauthenticated.** Static bearer keys were adopted and
  then removed fleet-wide by deliberate decision (see [ADRs](/adr)).
- **Each context owns its data.** Cross-context facts travel as REST/MCP
  calls or as CloudEvents.
  `process-path-management` and `labor-performance` make no REST or MCP
  calls to other contexts. They integrate through events only.

## How this site is generated, and what is copied vs written here

- **Per-context DDD artifacts are synced copies.** Each context repository
  keeps an artifact pack on `develop`, derived from its own code. These
  pages are copied here without edits, and each one starts with a
  "Synced from" note that links to its source:
  - Core Domain Chart
  - Bounded Context Canvas
  - Context Map
  - Aggregate Design Canvas
  - Domain Message Flow
  - EventStorming
  - Ubiquitous Language
  - Class Diagram
  - Entity-Relationship
  - Sequence Diagrams
  - Domain Events

  To fix one, edit it in the owning repository and re-sync. Each context also
  has a business-context page and a landing page written here. Most contexts
  also have an Async API page here that describes their Kafka topics.
- **Strategic Design** is written here, from the synced per-context pages.
  It follows the [ddd-crew](https://github.com/ddd-crew) templates:
  - Domain Vision
  - Core Domain Chart
  - Subdomain Classification
  - Big Picture EventStorming
  - Context Map
  - Domain Message Flows
  - Event Standard
  - Ubiquitous Language

  The [DDD Starter Modelling Process](/strategic-design/ddd-starter-modelling-process)
  walks through the fleet one step at a time and links to the artifact each
  step produces.
- **REST API reference** is generated from each context's
  `apis/openapi.yaml`, the same spec each service lints in its own CI.
  Regenerate it with `npm run gen-api-docs:all`.
- **Async API reference** is generated from each context's
  `apis/asyncapi.yaml` by the official AsyncAPI Generator
  (`@asyncapi/html-template`) and embedded as static HTML. Regenerate it
  with `npm run gen-async-docs:all`.
- **Architecture section.** The C4 views and the fleet summaries of the
  domain model, data model and runtime flows are written here. They are
  checked against each context's synced class, entity-relationship and
  sequence pages and its code on `develop`.
- **ADRs** are linked to their own repositories, never copied, so they
  never drift.

`npm run validate:mermaid` parses and renders every Mermaid diagram on this
site in a real browser. `docusaurus build` does not check diagrams that
render client-side, so without this step a syntax error would reach the
published site as an error box.

## Scope

This site documents the **twelve backend contexts** listed above (eleven
domain bounded contexts and `warehouse-ops-agent`). The fleet's twelfth
domain context, `network-inventory-planning`, is not aggregated yet.
The two frontend repositories (`warehouse-console`, `warehouse-ui-kit`) and
the deployment repository (`warehouse-infra`) appear on context pages where
relevant, for example as Module Federation remotes or in the Kafka topology.
They are not bounded contexts in the Evans/Vernon sense, so they have no DDD
artifacts here.

## Navigating this site

| Section | What it covers |
| --- | --- |
| [Strategic Design](/strategic-design) | Fleet-wide: the DDD Starter Modelling Process, domain vision, core domain chart, subdomain classification, [Big Picture EventStorming](/strategic-design/eventstorming-big-picture), context map, domain message flows, the CloudEvents event standard, ubiquitous language |
| [Architecture](/architecture) | Structural views: C4 levels 1–3, the domain model, the persistence model, and runtime sequence flows |
| [Bounded Contexts](/contexts) | Per context: business context, then the synced ddd-crew artifact pack (ubiquitous language, core domain chart, Bounded Context Canvas, context map, Aggregate Design Canvas, domain events, domain message flow, EventStorming, class diagram, entity-relationship, sequence diagrams), then the Async API narrative where the context has one |
| [API Reference](/api-reference) | Per context: generated REST (OpenAPI) and async (AsyncAPI) documentation |
| [ADRs](/adr) | Index of Architecture Decision Records, linking to each context's own repository |
| [Glossary](/glossary) | Key terms from every context's ubiquitous language, in one alphabetical index |

## Study-project disclosure

`warehouse-systems` is an educational Domain-Driven Design exercise
following real industry-standard patterns (WMS/WES/WCS, CloudEvents,
RFC 7807, hexagonal architecture). It is not a production system and is not
affiliated with, endorsed by, or representative of Amazon, Manhattan
Associates, Blue Yonder, or any other company. Where this documentation
grounds a design decision in public industry research (e.g. how Amazon's
fulfillment centers work), that research is cited. Anything derived from it
is labeled as a *reference model*, not as a factual claim about any real
company's internal systems.
