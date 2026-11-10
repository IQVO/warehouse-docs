# warehouse-docs: thin wrappers over the npm scripts and the offline gates that CI `build-check`
# (.github/workflows/docs.yml) runs. The live develop-drift check needs GITHUB_TOKEN and the network,
# so it is not part of check-fast; run it with `make drift-gate`.
.PHONY: install typecheck gen-check drift-test drift-gate mermaid build check check-all

install: ## npm ci at the root, then the isolated AsyncAPI toolchain (a root npm ci does not recurse)
	npm ci
	npm --prefix tools/asyncapi-gen ci --no-audit --no-fund

typecheck: ## tsc over docusaurus.config.ts, the sidebars and src/ (needs `make install`)
	npm run typecheck

gen-check: ## every generated page matches its model / registry (offline, stdlib + node)
	node scripts/gen-alert-catalogue.mjs --check
	python3 scripts/capability-map/generate.py --check
	python3 scripts/a2a-cards.py --check-page
	python3 scripts/test_agent_catalogue.py
	python3 scripts/agent-catalogue.py --check-page
	python3 network/scripts/check_model.py --pages
	python3 network/scripts/gen_pages.py --check
	python3 storefront/scripts/check_model.py --pages
	python3 storefront/scripts/gen_pages.py --check
	python3 yard/scripts/check_model.py
	python3 yard/scripts/gen_pages.py --check

drift-test: ## offline unit tests of the develop-drift gate
	python3 scripts/test_check_develop_drift.py

drift-gate: ## the live gate against every context repo's develop (needs GITHUB_TOKEN; exit 2 = producer unreadable)
	python3 scripts/check-develop-drift.py

mermaid: ## parse + render every Mermaid diagram in a real browser
	npm run validate:mermaid

build: ## regenerate the REST + AsyncAPI references, then docusaurus build
	npm run build

check: gen-check drift-test typecheck

check-all: check drift-gate build

# --- agent harness (harness-template v3) -----------------------------------
.PHONY: check-fast guide-lint harness-test
# Fast local gate used by the agent Stop hook (this repo's own quick checks).
check-fast: gen-check drift-test

guide-lint: ## lint agent guides: skills load, references resolve, context budget
	python3 scripts/harness/guide_lint.py

harness-test: ## unit-test the agent hooks (pre/post/stop)
	python3 scripts/harness/test_hook.py
	python3 scripts/harness/test_red_issue.py
