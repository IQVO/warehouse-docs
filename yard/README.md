# yard (yard management docs instance)

Domain documentation for **yard management** (a YMS) in the warehouse-systems fleet:
gate, yard and dock doors, modelled with Domain-Driven Design as two bounded contexts
in the `wms` tier, `dock-scheduling` and `yard-management`.

Served at `/yard/` inside [warehouse-docs](https://github.com/IQVO/warehouse-docs); not a standalone site.

**Status: proposed design, nothing built** (2026-11-05). The plan (waves, decisions, briefs)
is kept with the orchestrator; an as-built refresh follows each service.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical yard model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: transitions use declared states, events match their aggregate, REST routes match inbound rows, publish/consume symmetry, and every consumed fleet event and field exists in the producer's AsyncAPI copy under `apis/<repo>/asyncapi.yaml` (`--fleet DIR` reads `origin/develop` of sibling checkouts instead). |
| `scripts/gen_pages.py` | Generates the strategic pages from the model; `--check` fails when a page and the model disagree. |
| `docs/` | The site pages (Docusaurus instance `yard`). |

## Local

```bash
python3 yard/scripts/check_model.py
python3 yard/scripts/gen_pages.py --check
npm run validate:mermaid
```
