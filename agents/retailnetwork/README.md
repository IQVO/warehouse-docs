# Retail-network agent knowledge (canonical)

Canonical rule set for the retail-network services (`customer-ordering`, `delivery-promise`, `last-mile-delivery`,
`linehaul-transportation`, `node-performance`, `node-topology`, `offer-availability`, `order-sourcing`,
`shipping-and-tracking`, `vendor-connectivity`). It mirrors `agents/fleet/` and is synced into each network repo's
`.claude/rules/fleet/` by the same mechanism (`warehouse-harness-template` + `fleet_drift.py`).

Two sets, one discipline:

- `agents/fleet/` — the warehouse-systems fleet (`com.warehouse.<subdomain>.<context>...` types,
  `warehouse.<ctx>.*` topics).
- `agents/retailnetwork/` (this directory) — the retail network (`com.retailnetwork.<tier>.<context>...` types,
  `retailnetwork.<ctx>.events` / `.analytics` topics).

Of the seven files, six are rules. Five of them — `context-boundaries.md`, `gitflow-and-ci.md`,
`idempotency-and-outbox.md`, `kafka-testing-and-consumers.md`, `no-auth-and-mcp.md` — are **byte-identical** to
their `agents/fleet/` counterparts and must stay that way: edit the shared text in one place and copy it verbatim
to the other set in the same change. Only `cloudevents.md` differs between the sets (the network namespace,
sources, dataschemas and topics); edit each set's `cloudevents.md` on its own.

| Rule | When it matters |
|---|---|
| cloudevents.md | Kafka publish/consume, AsyncAPI |
| kafka-testing-and-consumers.md | tests, consumer groups |
| no-auth-and-mcp.md | inbound adapters (REST, MCP) |
| readme-standard.md | README edits (byte-identical twin of agents/fleet/readme-standard.md) |
| context-boundaries.md | outbound adapters, ports |
| gitflow-and-ci.md | workflows, Makefile, branching |
| idempotency-and-outbox.md | HTTP handlers, Postgres adapters |
