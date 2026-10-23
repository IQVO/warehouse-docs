# AGENTS.md — retail-network-docs

1. `model/model.yaml` is the source of truth. Add or change an aggregate,
   event, consumer or relationship there first, run
   `python3 scripts/check_model.py --pages`, then update the pages.
2. Never invent a message on a page. Every CloudEvents type printed in
   `docs/` must be `com.retailnetwork.<tier>.<context>.<entity>.<Event>` with
   the tier and producer the model gives.
3. Keep facts and model apart. A claim about the operator, its seller APIs, Google,
   Walmart, Shopify or an OMS vendor needs a numbered citation from
   the citations ledger (held privately, outside the repo); a claim about warehouse-systems needs a
   repository path. Everything else is labelled as the proposed model.
4. The hard boundary: no retail-network context consumes a `warehouse.*`
   topic or calls a warehouse-systems service; the only seam is the Vendor
   API that `network-fulfillment` calls.
5. Mermaid: every diagram must render and stay <= 1020 px wide
   (`npm run validate:mermaid`); github.com scales diagrams into a ~1010 px
   frame. No `;` inside sequence messages.
6. Branches: `feature/*` -> PR into `main`; CI must be green before merge.
