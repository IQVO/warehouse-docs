---
id: benchmarks
title: Benchmarks
sidebar_label: Benchmarks
description: "The third-party research and quantitative benchmarks the storefront design rules rest on, with neutral citations; verbatim quotes and URLs are held privately."
---

# Benchmarks

The design rules of the storefront rest on published third-party research.
This page names each third party by name — none of them is the operator this
study's network is modelled on, and no operator brand, product or program is
named anywhere in this instance. Verbatim quotes and source URLs are held in a
private citations ledger, outside this repo; the bracketed numbers [n] map to
it.

## Reference decompositions

| Reference | Its contexts / capabilities | What the design takes |
| --- | --- | --- |
| A widely used open-source reference e-commerce application (.NET) [17][20] | Separate services for catalog, basket, ordering, identity, webhooks, an order processor, a payment processor and the web app. Its order passes Submitted, AwaitingValidation, StockConfirmed, Paid, Shipped, Cancelled. | The same split for basket vs ordering vs payment. Its "order first, validate stock and payment later" sequence is rejected (D5): our network releases orders to vendor nodes soon after placement. |
| Composable-commerce capability lists [18] | Product information; pricing and promotions; cart and checkout; payments; search and merchandising; content; order management; customer accounts. Product data needs exactly one owner, and the search index is fed by product content plus price and stock. | The six storefront contexts map 1:1 onto these, minus order management and customer accounts, which the network already owns. The item master stays in offer-availability; content only enriches it. |
| DDD literature [19] | "Product" means different things in a product catalogue, inventory, shopping cart and order management. | Each context keeps its own Product-like model; only `catalogItemId` crosses boundaries. |
| Saga literature (microservices.io) [14][15][16] | Cross-service transactions are sagas with compensating transactions [14]; a PENDING-style semantic lock prevents a concurrent command from overwriting an unfinished saga [15]; structure the saga around one pivot transaction followed by retriable steps [16]; a client that starts a saga synchronously learns the outcome by polling or by a notification [14]. | `checkout` is an orchestration saga: authorize (compensatable: void) -> place order (pivot) -> retriable steps via events. PLACING is the semantic lock. |
| The Backends For Frontends pattern (Sam Newman) [13] | One backend per user experience, maintained by the UI team, inside the perimeter. | `storefront-bff` is the web experience's backend and the only thing the browser reaches. |

## Quantitative benchmarks that set design rules

| Benchmark | Figure | Design rule it drives |
| --- | --- | --- |
| Cart abandonment (Baymard Institute, UX research) [1] | 70.22% average across 50 studies | Funnel analytics events from cart and checkout from day one. |
| Abandonment reasons, excluding "just browsing" (Baymard Institute) [1] | Extra costs too high 40%, delivery too slow 20%, did not trust the site with card data 19%, forced account 18%, long checkout 17%, could not see total cost up front 12%, card declined 10% | Delivery charge per tier visible on the product page and in the cart; total (incl. delivery and tax estimate) in the cart; guest checkout; card entry on PSP-hosted fields; a declined card keeps the session open for another try. |
| Checkout length (Baymard Institute) [2] | An ideal checkout needs as few as 12 form elements; the average US checkout shows 23.48 | The review step reuses saved address and cart data; target at most 12 form elements for a returning shopper. |
| Delivery date vs speed (Baymard Institute) [3] | 41% of sites show a speed instead of a date; users read the date as a promise; date ranges are easier than speed ranges; fetch dates asynchronously so a slow estimator never blocks the page | Show `deliverByEarliest..deliverByLatest` dates from delivery-promise everywhere, never "N business days"; load dates after the page renders. |
| Shipping cost on the product page (Baymard Institute) [4] | 64% of test users looked for shipping costs on the product page; 43% of sites do not show them | The product page shows the delivery charge per tier next to the date. |
| Order tracking and stock (Baymard Institute) [5] | 56% of sites do not integrate order tracking into the site; 68% do not allow buying temporarily out-of-stock items with a longer delivery time | Tracking page in the storefront from `GET /orders/{id}/tracking`. Out-of-stock purchase is impossible in this network (no offer without a feasible path); show "currently unavailable", recorded as a future idea (gap S6). |
| Search quality (Baymard Institute) [6] | 46% of desktop and 58% of mobile sites have mediocre-or-worse search UX; product-type queries are a named failure class | Search over title, description, attributes and category names, with category suggestions for product-type queries. |
| Speed and conversion (web.dev, web-vitals documentation) [7] | A 0.1 s mobile speed improvement went with 8.4% more retail conversions, a 9.1% higher product-page-to-basket progression and 9.2% higher spend | Server-time budgets per BFF route and a Lighthouse CI gate. |
| Core Web Vitals (web.dev) [8] | Good = LCP `<= 2.5 s`, INP `<= 200 ms`, CLS `<= 0.1`, judged at the 75th percentile | Release gate for `storefront-web`. |
| Card authorization validity (a payments provider's authorization documentation) [9] | Card-not-present, customer-initiated authorizations are valid 7 days on the four major card networks; one network's merchant-initiated window is 5 days (4 days 18 hours) | Capture per shipped group; re-authorize uncaptured allocations before expiry (STANDARD tier can take 7 calendar days). |
| Capture timing practice (a large commerce platform's help documentation) [10] | Authorize-at-checkout with automatic capture when the order is fulfilled, or per fulfilled line items | `CaptureOnShipment` per shipment group. |
| Card-data scope (PCI Security Standards Council FAQ 1292) [11] | SAQ A needs every element of the payment page to come from a PCI DSS validated third party | The storefront never sees a card number: only a PSP token. |
| Embedded iframes (PCI SSC clarification, reported by a law firm's privacy blog) [12] | Embedded-iframe merchants must also confirm script-attack defences and may not store, process or transmit card data | The simulator mimics hosted fields; the web page gets a strict CSP. |
