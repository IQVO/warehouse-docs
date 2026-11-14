# Producer contract readiness gaps (Phase 0 audit, origin/develop)

Producers with >=1 consumer: 32 (REST cross-repo edges: 33, event consumer->producer pairs: 84, intra-repo reports edges: 7)

- **24/32 producers lack Schemathesis** in CI.
- **6 producer specs ship zero OpenAPI examples**: customer-payments, pricing, product-content, product-discovery, shipping-and-tracking, shopping-cart.
- **0 producers run a spec breaking-change gate (oasdiff).**

| Producer | Schemathesis | oasdiff | OpenAPI ops/examples | AsyncAPI msgs/examples | golden files |
|---|---|---|---|---|---|
| checkout | **NO** | no | 3/1 | 14/7 | yes |
| customer-ordering | **NO** | no | 12/7 | 46/23 | yes |
| customer-payments | **NO** | no | 8/0 | 28/14 | yes |
| delivery-promise | **NO** | no | 15/14 | 53/51 | yes |
| dock-scheduling | **NO** | no | 22/25 | 72/34 | yes |
| facility-layout | yes | no | 38/232 | 48/19 | yes |
| fulfillment-execution | yes | no | 25/204 | 144/29 | yes |
| inbound-receiving | **NO** | no | 23/41 | 82/31 | yes |
| inventory-storage | yes | no | 25/250 | 184/33 | yes |
| labor-performance | yes | no | 8/12 | 41/45 | yes |
| network-fulfillment | **NO** | no | 10/28 | 97/14 | yes |
| network-inventory-planning | **NO** | no | 17/24 | 41/0 | none |
| node-performance | **NO** | no | 2/14 | 19/18 | yes |
| node-topology | **NO** | no | 17/17 | 14/11 | yes |
| offer-availability | **NO** | no | 10/9 | 17/16 | yes |
| order-management | yes | no | 8/73 | 116/22 | yes |
| outbound-shipping | **NO** | no | 15/13 | 83/22 | none |
| pick-face-replenishment | **NO** | no | 14/28 | 41/13 | yes |
| pricing | **NO** | no | 13/0 | 14/7 | yes |
| process-path-management | yes | no | 9/36 | 45/26 | yes |
| product-content | **NO** | no | 12/0 | 10/5 | yes |
| product-discovery | **NO** | no | 3/0 | 12/11 | none |
| product-master | **NO** | no | 17/45 | 35/13 | yes |
| returns-processing | **NO** | no | 14/25 | 51/18 | yes |
| shipping-and-tracking | **NO** | no | 8/0 | 1/24 | yes |
| shopping-cart | **NO** | no | 11/0 | 22/11 | yes |
| slotting-optimization | **NO** | no | 11/26 | 52/15 | yes |
| task-interleaving | **NO** | no | 10/31 | 63/12 | yes |
| warehouse-planning | **NO** | no | 21/125 | 83/99 | none |
| wes-work-planning | yes | no | 14/149 | 148/57 | yes |
| workforce-management | yes | no | 13/96 | 75/13 | yes |
| yard-management | **NO** | no | 46/22 | 214/52 | yes |

## Findings
- Event subscriptions in this registry are derived from CODE (non-test topic literals in each consumer's cmd/ and internal/) — asyncapi operation semantics proved unreliable for edge derivation (mixed publish/subscribe perspectives across repos); the asyncapi files remain the MESSAGE PAYLOAD contract to pin.
- AsyncAPI channel-perspective convention: producer asyncapi.yaml documents its OWN topics under `subscribe:` and counterparty topics it consumes under `publish:` (tagged `consumed`) — inverted from the AsyncAPI 2.6 app perspective, though not uniformly across the fleet. Read specs per-file, verify against reader config.
- fulfillment-execution reads WORK_PLANNING_A2A_URL (wes-work-planning A2A) in code but never wires it in its chart — A2A edge, deferred to the MCP/A2A follow-up.
- warehouse-ops-agent reads LLM_BASE_URL (external LLM API) — out of scope.
- 15 external URL envs (payment simulators, OTLP, prometheus, vendor hosts) — out of scope.
