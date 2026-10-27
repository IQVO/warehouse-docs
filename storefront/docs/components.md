---
id: components
title: Edge and supporting components
sidebar_label: Edge and supporting components
description: "The three storefront repos that are not bounded contexts: storefront-bff (the only storefront edge), storefront-web (React SSR) and payment-provider-simulator (the external payment provider stand-in). Built on develop, not deployed."
slug: /components
---

# Edge and supporting components

Besides the six bounded contexts, the storefront has three repos that carry no
domain model and therefore no ddd-crew pack. All three are **built on develop,
not deployed**: none has an entry in warehouse-infra's `terraform/apps.yaml`
(checked on warehouse-infra `develop` at `c6a4d76`, 2026-10-27).

| Repo | What it is | develop | Binaries | ADRs | Deployment |
| --- | --- | --- | --- | --- | --- |
| [`storefront-bff`](https://github.com/IQVO/storefront-bff) | Go backend-for-frontend, the only storefront edge under `/api/storefront` | `9f43d0e` | `cmd/api` | [2](/storefront/adr#storefront-bff) | not deployed |
| [`storefront-web`](https://github.com/IQVO/storefront-web) | React 19 + React Router 7 framework mode, SSR on Node | `161efc1` | Node server (`server/`), no Go | [5](/storefront/adr#storefront-web) | not deployed |
| [`payment-provider-simulator`](https://github.com/IQVO/payment-provider-simulator) | Go stand-in for the external payment provider customer-payments calls | `e80c7f5` | `cmd/api` | [2](/storefront/adr#payment-provider-simulator) | not deployed |

None of the three has adopted the fleet observability standard: no OTel SDK is
wired in `storefront-bff` or `payment-provider-simulator` (`go.opentelemetry.io`
appears only as an indirect module in the BFF's `go.mod`), and `storefront-web`
has no OpenTelemetry dependency. The standard was adopted by the six context
services only (see each context's *Service and operations* section).

## storefront-bff

The browser reaches the storefront only through this service. It has no domain
model, no database and no Kafka producer or consumer; each route is a thin
composition over upstream REST APIs, and upstream answers (including their RFC
9457 problem details) are relayed unchanged. Facts from its
[`apis/openapi.yaml`](https://github.com/IQVO/storefront-bff/blob/develop/apis/openapi.yaml)
and [ADR 0002](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0002-storefront-bff-assumptions.md):

- **State, not authentication.** Cart, shopper and last checkout ids live in
  the `sf_state` cookie. There is no authentication anywhere.
- **Idempotency.** The BFF mints an `Idempotency-Key` per user action
  (deterministic per route, subject and payload inside a ten-minute window, or
  pinned by the page with the `X-Action-Id` header) and forwards it to upstream
  commands.
- **No PII at rest.** Saved addresses pass through without being stored or
  logged; request and response bodies are never logged; only PSP payment-method
  tokens are accepted, never card data.
- **Time budgets.** 2 s for queries, 5 s for commands, 15 s for checkout
  confirm (`BUDGET_QUERY_MS`, `BUDGET_COMMAND_MS`, `BUDGET_CONFIRM_MS`); an
  expired budget answers 504 and is never retried.
- **Upstreams** (mandatory boot config, `internal/config/config.go`):
  `PRODUCT_DISCOVERY_URL`, `PRICING_URL`, `SHOPPING_CART_URL`, `CHECKOUT_URL`
  (four storefront contexts) and `DELIVERY_PROMISE_URL`, `CUSTOMER_ORDERING_URL`
  (two retail-network contexts, Open Host Service routes only). The BFF does
  not call product-content or customer-payments.

### Route table

All routes are under `/api/storefront`; the generated reference is under
[API Reference](/storefront/api-reference/rest/storefront-bff/storefront-bff-api).
The upstream column is read from `internal/application/usecases/*.go`.

| BFF route | Upstream call(s) |
| --- | --- |
| `GET /products` | product-discovery `GET /products` (allow-listed search filters only) |
| `GET /products/{id}` | product-discovery `GET /products/{catalogItemId}` |
| `POST /products/{id}:delivery-dates` | delivery-promise `POST /delivery-offers:quote`, joined with pricing `GET /delivery-charge-schedules/current` (a missing schedule only drops the charge) |
| `POST /carts` | shopping-cart `POST /carts` |
| `GET /carts` | shopping-cart `GET /carts` |
| `GET /carts/{id}` | shopping-cart `GET /carts/{cartId}` |
| `POST /carts/{id}/lines` | shopping-cart `POST /carts/{cartId}/lines` |
| `PATCH /carts/{id}/lines/{item}` | shopping-cart `POST /carts/{cartId}/lines/{catalogItemId}:set-quantity` |
| `DELETE /carts/{id}/lines/{item}` | shopping-cart `POST /carts/{cartId}/lines/{catalogItemId}:remove` |
| `POST /carts/{id}/destination` | shopping-cart `POST /carts/{cartId}:set-destination` |
| `POST /carts/{id}/delivery:quote` | shopping-cart `POST /carts/{cartId}:quote-delivery` |
| `POST /carts/{id}/delivery:select` | shopping-cart `POST /carts/{cartId}:select-delivery` |
| `POST /checkout` | checkout `POST /checkout-sessions` |
| `GET /checkout/{id}` | checkout `GET /checkout-sessions/{sessionId}` |
| `POST /checkout/{id}:confirm` | checkout `POST /checkout-sessions/{sessionId}:confirm` (15 s budget) |
| `GET /orders` | customer-ordering `GET /orders?shopperId=` |
| `GET /orders/{id}` | customer-ordering `GET /orders/{orderId}` plus `GET /orders/{orderId}/tracking`, and checkout `GET /checkout-sessions/{sessionId}` for the totals when the cookie's last checkout placed this order |
| `POST /orders/{id}:cancel` | customer-ordering `POST /orders/{orderId}:cancel` |
| `POST /shoppers` | customer-ordering `POST /shoppers` |
| `POST /sessions` | customer-ordering `GET /shoppers?email=` (sets the cookie's shopper id; not a login) |
| `GET /me` | customer-ordering `GET /shoppers/{shopperId}` |
| `POST /me/addresses` | customer-ordering `POST /shoppers/{shopperId}/addresses` |

Plus `GET /healthz` and `GET /readyz` (not in the spec). Every customer-ordering
and delivery-promise route above is an Open Host Service route the network
model opens to the storefront; none is in-org or restricted.

## storefront-web

The server-side-rendered web experience: home, search and category, product
page, cart, account, checkout, confirmation, orders and order detail with
tracking (routes in `app/routes.ts`). Stack: React 19, React Router 7 framework
mode with SSR on Node (ADR 0001), Vite, TypeScript strict, vitest, Playwright and
Lighthouse CI; Node >= 22.18.

- **One backend.** It talks only to `storefront-bff` through the relative base
  `/api/storefront` and never invents ids (ADR 0002). `BFF_URL` is server-only;
  `npm start` proxies `/api/storefront` to it, and `STOREFRONT_STUB=1` serves an
  in-memory stub BFF for CI and demos (ADR 0005).
- **Strict CSP.** Nonce-based Content-Security-Policy on every HTML response, no
  inline script or style, `connect-src 'self'` (ADR 0003).
- **Simulated payment fields.** The page posts only a scenario token, never a
  card number (ADR 0004).
- **CI sensors** (`.github/workflows/ci.yml`): `web` (lint, typecheck, coverage,
  build), `no-network-url-in-bundle` (the client bundle holds only
  `/api/storefront` URLs), `lighthouse-budgets` (LCP at most 2.5 s, TBT at most 200 ms,
  CLS at most 0.1), `e2e` (Playwright journeys against the stub BFF), `guide-lint`,
  `docker-build`.

## payment-provider-simulator

The external payment provider of
[customer-payments](/storefront/contexts/customer-payments): its HTTP contract is
the one customer-payments documents in
[ADR 0002](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0002-customer-payments-assumptions.md),
assumption A12, so replacing it with a real provider changes only
`PAYMENT_PROVIDER_URL` in customer-payments. It owns a Postgres database
(`DATABASE_URL` is mandatory; one migration,
`0001_provider_schema`), and it publishes and consumes **no** events
([ADR 0002](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0002-payment-provider-simulator-assumptions.md)
A16): its `apis/asyncapi.yaml` declares no channels and no operations.

| Route | Purpose |
| --- | --- |
| `POST /tokens` | issue a scenario token `tok_<scenario>_<suffix>` |
| `POST /authorizations` | place a hold: `201` with id and expiry, or `402` decline |
| `POST /authorizations/{id}/void` | release the remaining hold |
| `POST /authorizations/{id}/reauthorize` | replace by a new hold (new id and expiry) |
| `POST /authorizations/{id}/reduce` | lower the remaining hold (partial release) |
| `POST /authorizations/{id}/captures` | capture |
| `POST /authorizations/{id}/refunds` | refund captured money |
| `GET /authorizations/{id}` | read a hold (test aid) |

Every POST carries an `Idempotency-Key`. A 4xx decline is final (`402`
problem+json with a `code` member); 5xx and 504 are transient.

**Test tokens.** A token names its scenario, so a test always gets the same
outcome. The bare literals `tok_approve`, `tok_decline`, `tok_timeout` and
`tok_expire-early` work too.

| Scenario | Behaviour |
| --- | --- |
| `approve` | authorizes; the hold lasts 7 days |
| `decline` | every authorization answers `402 payment-declined`, `code: CARD_DECLINED` |
| `timeout` | answers `504 provider-timeout` after `PROVIDER_TIMEOUT_DELAY` (default 1 s, at most 2 s); no hold is created |
| `expire-early` | authorizes; the hold lasts 5 minutes, so re-authorization before expiry is testable |

A string that is not a token is `422`; a 13 to 19 digit string is refused as a
card number. Source: the repo's
[README](https://github.com/IQVO/payment-provider-simulator/blob/develop/README.md)
and ADR 0002.
