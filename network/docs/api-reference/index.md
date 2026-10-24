---
id: index
title: API Reference
sidebar_label: Overview
description: "The as-built REST contracts of the ten retail-network contexts, rendered from apis/<context>/openapi.yaml."
slug: /api-reference
---

# API Reference

Each context's REST contract is an OpenAPI 3.0 file at
`apis/<context>/openapi.yaml`, rendered here at build time. All ten are as
built, copied from each service's own `apis/openapi.yaml`.
The one that matters across organizations is
[`vendor-connectivity`](/network/integration/vendor-api): it is the Published Language
the warehouse-systems fleet's `network-fulfillment` conforms to. Routes marked
"in-org" in a context's canvas are called only by sibling network contexts.

Errors use `application/problem+json` (RFC 9457). Every state-changing POST or
PUT takes an `Idempotency-Key` header. There is no authentication, consistent
with the fleet; PII is synthetic and confined (ADR 0006).
