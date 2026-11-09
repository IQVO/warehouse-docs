# yard (yard management docs instance)

Domain documentation for **yard management** (a YMS) in the warehouse-systems fleet:
gate, yard and dock doors, modelled with Domain-Driven Design as two bounded contexts
in the `wms` tier, `dock-scheduling` and `yard-management`.

Served at `/yard/` inside [warehouse-docs](https://github.com/IQVO/warehouse-docs); not a standalone site.

**Status: built on develop (merged 2026-11-08), not deployed** (as-built refresh 2026-11-09). Both services
([IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling), [IQVO/yard-management](https://github.com/IQVO/yard-management))
exist on `develop`; neither is registered in warehouse-infra. The model records the as-built contracts and the
REST reference of this section is not generated yet.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical yard model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: transitions use declared states, events match their aggregate, REST routes match inbound rows, publish/consume symmetry, every consumed fleet event and field exists in the producer's AsyncAPI copy under the repository's `apis/<repo>/asyncapi.yaml`, and each yard context's published events, streams, fields and REST routes equal its own contract copy under `yard/apis/<repo>/` (`--fleet DIR` reads `origin/develop` of sibling checkouts instead). |
| `scripts/gen_pages.py` | Generates the strategic pages from the model; `--check` fails when a page and the model disagree. |
| `apis/<repo>/` | Byte copies of each service's `develop` contract files (`openapi.yaml`, `asyncapi.yaml`, dock-scheduling's `openapi-reports.yaml`), kept equal by the repository's `scripts/check-develop-drift.py`; `check_model.py` compares the model with them. |
| `docs/` | The site pages (Docusaurus instance `yard`). |

## Local

```bash
python3 yard/scripts/check_model.py
python3 yard/scripts/gen_pages.py --check
npm run validate:mermaid
```
