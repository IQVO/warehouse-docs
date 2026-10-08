---
id: index
title: Strategic Design
sidebar_label: Strategic Design
description: The fleet-wide DDD strategic-design artifacts, produced with the ddd-crew method.
slug: /strategic-design
---

# Strategic Design

Strategic design answers "what are our bounded contexts, how important is
each one, and how do they relate?" — before any code or aggregate exists.
The artifacts below follow the open, freely-licensed templates maintained by
[**ddd-crew**](https://github.com/ddd-crew), the community collection of
Domain-Driven Design modelling tools referenced throughout this fleet's own
`CLAUDE.md` files and ADRs. Start with the
[DDD Starter Modelling Process](/strategic-design/ddd-starter-modelling-process)
page, which maps every artifact on this site to the step that produces it.

| Artifact | ddd-crew template | What it answers |
| --- | --- | --- |
| [DDD Starter Modelling Process](/strategic-design/ddd-starter-modelling-process) | [ddd-starter-modelling-process](https://github.com/ddd-crew/ddd-starter-modelling-process) | Which step (Understand, Discover, Decompose, Strategize, Connect, Organise, Define, Code) produced which artifact on this site? |
| [Domain Vision](/strategic-design/domain-vision) | — | What does this platform do, and where does it win? |
| [Core Domain Chart](/strategic-design/core-domain-chart) | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) | Which of the twelve plotted contexts are the strategic differentiators worth the most investment? |
| [Subdomain Classification](/strategic-design/subdomain-classification) | (companion to core-domain-charts) | Core / Supporting / Generic, per bounded context, with the justification. |
| [Big Picture EventStorming](/strategic-design/eventstorming-big-picture) | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) | What is the end-to-end order-to-ship timeline of domain events across every context, and where are the hotspots? |
| [Context Map](/strategic-design/context-map) | [context-mapping](https://github.com/ddd-crew/context-mapping) | How do the fourteen contexts relate — Partnership, Customer/Supplier, Open-Host Service, Conformist, ACL? |
| [Domain Message Flow Modelling](/strategic-design/domain-message-flows) | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) | How do commands, events, and queries actually flow between contexts for the platform's key business processes? |
| [Event Standard (CloudEvents 1.0)](/strategic-design/event-standard-cloudevents) | (fleet standard) | The one mandatory envelope on every Kafka topic, the subdomain table, and the cross-service `type` catalogue. |
| [Audit decisions, October 2026](/strategic-design/audit-decisions-2026-10) | (fleet record) | The product and architecture decisions taken for the findings of the October 2026 audit, with the reason and ADR for each. |
| [Ubiquitous Language](/strategic-design/ubiquitous-language) | (companion to [welcome-to-ddd](https://github.com/ddd-crew/welcome-to-ddd)) | The shared vocabulary spanning every context, and where it's defined. |

## Method note

This platform's strategic design is grounded in a public-research reference
model — `amazon-fulfillment-ddd.md` — which reconstructs how large-scale
fulfillment operations (WMS/WES/WCS) actually work from cited public sources,
then derives a defensible DDD model from that evidence. Every artifact on
this site that classifies a subdomain or draws a context-map edge traces back
to that reference model and to each bounded context's own DDD artifact pack
(`docs/docs/ddd/` in most context repositories, `docs/ddd/` in
`network-fulfillment`), which is synced onto this site. Nothing here is
invented independently of what the code and each context's own documented
reasoning already say.

For the per-context artifacts that build on this strategic layer (Core
Domain Chart, Bounded Context Canvas, Context Map, Aggregate Design Canvas,
Domain Message Flow, EventStorming, domain events and the class,
entity-relationship and sequence diagrams), see
[Bounded Contexts](/contexts).
