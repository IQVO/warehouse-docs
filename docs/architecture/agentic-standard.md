---
title: Agentic Standard v2
sidebar_label: Agentic Standard v2
description: "The fleet decision on how agents are exposed, governed and evaluated across MCP, A2A and CloudEvents: authority levels per tool, attributable agent actions, a complete MCP surface, spec conformance, long-running work, a generated catalogue, GenAI telemetry, evaluation gates and an agentic commerce edge."
---

# Agentic Standard v2

Status: accepted, phased rollout. Date: 2026-11-02. Scope: the warehouse fleet and the retail network.

The fleet already runs the three transports that matter, and this decision does not replace any of them:

| Transport | Carries | Unchanged rule |
|---|---|---|
| Kafka + CloudEvents | facts between contexts | the only data-sync channel |
| MCP | an agent's tools | additive inbound adapter, Streamable HTTP, official Go SDK |
| A2A | delegation of a goal to another context's agent | message-only skills, at most two per context |

What changes is governance and completeness on top of them. Nothing in a domain or application layer moves, the hot path is untouched, and every endpoint stays unauthenticated (the 2026-09-11 revert stands; re-adopting auth is a separate decision plus an ADR).

## Why now

Across the WMS and supply-chain market in 2026 the same patterns converge: named role agents split into interactive assistants and background monitors; graduated authority per agent; a control plane with approvals and a traceable action record; MCP and A2A so customers' own AI platforms can reach the agents; a single workspace of issues with recommended resolutions; procedures tested on historical scenarios before go-live. The fleet already has the protocols on every context. It lacks the governance, the completeness and the evaluation discipline around them.

## The nine standards

| Id | Standard | Enforced by |
|---|---|---|
| AS-1 | Every MCP tool and A2A skill declares an authority level L1 to L4 | fleet rule agent-authority, fitness test per repo, catalogue |
| AS-2 | An agent-initiated state change is attributable through an initiated_by data field on the domain event | the same rule, contract test on the pilot event |
| AS-3 | A complete MCP surface: tools, at least one resource, at least one prompt | golden registry test |
| AS-4 | MCP specification revision 2026-07-28 conformance (stateless, server discovery) | post-deploy conformance probe |
| AS-5 | Long-running work returns a task handle (MCP Tasks extension, A2A task lifecycle); transactional skills stay message-only | per-tool review plus probe |
| AS-6 | One generated catalogue of MCP servers and A2A agents with authority levels, with a live drift check | generator check in the docs CI |
| AS-7 | OpenTelemetry GenAI semantic conventions on agent and tool spans, plus an agent-operations dashboard as code | dashboard-as-code check |
| AS-8 | Agents earn authority through replay evaluation and shadow-mode agreement | CI scenario replay gate |
| AS-9 | An agentic commerce edge on the retail network (catalog and checkout capabilities over MCP, mandate-based payments simulated) | retail-network ADR plus e2e scenario |

### AS-1 Authority levels

| Level | Name | What the tool may do | Gate the caller must apply |
|---|---|---|---|
| L1 | Inform | read facts, change nothing | none |
| L2 | Recommend | return a proposal or ranking, change nothing | none |
| L3 | Act on approval | change state | a human confirmation between proposal and call |
| L4 | Act within an envelope | change state without per-call approval | only where the owning context's domain enforces the envelope as an invariant, granted by an ADR in that context |

There is no L5. Declaration: MCP tool metadata key com.warehouse/authority with the value L1 to L4; A2A skill tag authority:L1 to authority:L4. A write is L3 unless an ADR says otherwise. Because endpoints are unauthenticated, the level documents the gating the caller applies; the confirmation lives in the client (the ops agent's HMAC confirmation token from its act slice), not in the context.

### AS-2 Attribution

The durable record of an agent action is the domain event the owning context already publishes. When a write arrives through MCP or A2A, the adapter stamps initiated_by into the event data. REST writes carry none. It is a data field, not a CloudEvents extension attribute, so the envelope standard is untouched.

A proposal event stream published by the ops agent is deliberately deferred: the ops agent owns no persisted state and no Kafka producer (its ADR 0001 and ADR 0027), and giving it both is a change of its own that needs its own ADR. Until then the proposal trail is the confirmation token, a proposal identifier carried into initiated_by, and spans and logs. The seam is recorded, not removed.

### AS-3 to AS-7 in one paragraph each

AS-3: seven contexts already expose tools, resources and prompts; the other MCP servers expose tools only. Resources are scoped read models, never dumps; prompts are the operator procedures, which is the fleet's answer to procedures-as-agents. AS-4: the 2026-07-28 revision removes protocol sessions and the initialize handshake and adds server discovery; the pinned Go SDK already negotiates it, so the fleet moves once, in a single wave, and post-deploy probes stop relying on a session header. AS-5: expensive evaluations (capacity plans, slot plan review, network what-ifs) return a task handle; quick request and response skills stay as they are. AS-6: the A2A card index generator grows into an agent catalogue that also emits a private server.json per MCP server (registry format, Streamable HTTP remote) and the authority levels; it is not published to the public registry because the servers are cluster-internal. AS-7: keep the mcp.tool and a2a.skill spans, add the GenAI operation and agent name attributes, and ship one agent-operations dashboard.

### AS-8 Earned authority

Each agent behaviour has a godog feature and a replay scorecard on the warehouse-day simulator. L2 to L3 requires shadow-mode agreement above an agreed threshold over N replayed days. L3 to L4 requires an ADR in the owning context. This is the same left-shift as the repo gates.

### AS-9 Commerce edge

The storefront contexts that have an A2A agent but no MCP server gain one. Product discovery targets the Universal Commerce Protocol catalog capability over its MCP binding; checkout and payments follow later, with a mandate model simulated by the payment provider simulator. The Agentic Commerce Protocol is deferred.

## Feature verdicts

Each candidate behaviour was checked against the current code and ADRs before being accepted.

| Id | Behaviour | Verdict | Evidence and constraint |
|---|---|---|---|
| F1 | Explain why work is not being released | PROCEED, L1 | read-only over flow status, availability and exceptions; ops agent stays read-only |
| F2 | Labor reallocation proposal and approved assignment | PROCEED, L2 then L3, pilot | workforce-management already offers assign_labor on MCP and A2A with domain invariants (one active assignment, certification match); labor-performance only serves reads; reuses the act-slice confirmation flow |
| F3 | Auto-close a fully received receipt | DEFER, L4 candidate | inbound-receiving MCP is read-only by charter, so a close tool first needs an ADR in that context amending the charter; the envelope (zero discrepancies on every line) is a domain invariant, which is what makes L4 admissible |
| F4 | Draft an ASN from a document | DEFER, L3 | needs an outbound extraction port in stub mode behind an anti-corruption layer, owned by vendor connectivity or seller inbound; draft passes normal validation |
| F5 | Cycle-count proposals | PROCEED, L2 only | RunCycleCount belongs to inventory-storage and an overage is reported, never auto-reconciled (its ADR 0002); the agent proposes, humans count |
| F6 | Exception triage | PROCEED, L1 and L2 | extends the advisory exception context already in the ops agent (its ADR 0028) |
| F7 | Agent inbox screen in the console | PROCEED | new console remote on the ops agent backend, following the MFE registration standard |
| F8 | Daily brief reasoner | PROCEED, L1 | finishes the documented next phase of the ops agent ADR 0004; deterministic fallback stays the arbiter |
| F9 | Shipment ETA risk | PROCEED, L1 | read-only outlook over shipping, linehaul and last-mile contexts |
| F10 | Agent shopping and checkout | PROCEED in phases | AS-9; catalog first, checkout later |

## Not adopted, on purpose

A no-code agent builder; a separate agent platform outside the bounded contexts (agents stay inside their context or in the ops agent); a shared data foundation for agent-to-agent negotiation (it would break database-per-context and events-for-facts); governed autonomy as a level; robotics and warehouse control orchestration (a reserved, unbuilt seam).

## Seams recorded, not built

Enterprise-managed authorization for MCP, signed Agent Cards and mutual TLS in A2A 1.0, and a gateway aware of MCP and A2A in front of or beside the current gateway. Each is a decision for later and none is a prerequisite.

## Rollout

| Phase | Content | Done when |
|---|---|---|
| 0 | this decision, the fleet rule, pinned contract names | merged |
| 1 | spike: one context on the 2026-07-28 revision with one task tool and authority metadata | probe shows discovery, stateless listing and a polled task |
| 2 | pilot F2 end to end in the cluster | proposal, approval, assignment, event with initiated_by, trace |
| 3 | fitness tests and generators in the harness template | each gate fails when broken once |
| 4 | fleet waves: metadata and surface completeness, conformance, behaviours | catalogue lists every tool and skill with its level |
| 5 | commerce edge | a catalog client completes discovery against the cluster |
| 6 | polish: interactive widgets for external clients, gateway evaluation | optional |

## References

- Model Context Protocol, specification revision 2026-07-28, key changes: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- MCP Tasks extension: https://modelcontextprotocol.github.io/ext-tasks/specification/2026-07-28/tasks.html
- MCP Apps extension: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- MCP Registry, publishing remote servers: https://modelcontextprotocol.io/registry/remote-servers
- A2A Protocol 1.0, what is new: https://a2a-protocol.org/latest/whats-new-v1/
- OpenTelemetry GenAI agent spans: https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md
- Universal Commerce Protocol, overview: https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp
- Fleet rule files: agents/fleet/agent-authority.md and agents/fleet/a2a.md in this repository
