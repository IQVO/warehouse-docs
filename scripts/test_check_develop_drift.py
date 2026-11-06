#!/usr/bin/env python3
"""Offline tests for scripts/check-develop-drift.py (injected fetcher, temp tree)."""
import atexit
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("dd", Path(__file__).with_name("check-develop-drift.py"))
dd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dd)

VENDOR_NEW = b"""openapi: 3.0.3
info: {title: vendor-connectivity, version: 1.0.0}
paths:
  /vendors/{vendorId}/suspensions:
    post: {operationId: suspendVendor, parameters: [{name: Idempotency-Key, in: header}]}
  /vendors/{vendorId}/reinstatements:
    post: {operationId: reinstateVendor}
  /vendor/purchase-orders:
    get:
      responses: {'200': {description: 'items and nextCursor'}}
"""
BFF_NEW = b"""openapi: 3.0.3
info: {title: storefront-bff, version: 1.0.0}
paths:
  /orders/{id}/cancellations:
    post: {operationId: cancelOrder, parameters: [{name: Idempotency-Key, in: header}]}
  /carts/{id}/delivery-quotes:
    post: {operationId: quote}
  /checkout/{id}/confirmations:
    post: {operationId: confirm}
"""


class Tree:
    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix="drift-test-"))
        atexit.register(shutil.rmtree, self.root, True)

    def write(self, rel, text):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(text if isinstance(text, bytes) else text.encode())
        return p


def fetcher(files, unreadable=()):
    def fetch(repo, path):
        if repo in unreadable:
            raise dd.Unreadable(f"{repo}: boom")
        if (repo, path) not in files:
            raise dd.NotFound(f"{repo}:{path}")
        return files[(repo, path)]

    return fetch


def make(vendor_copy=VENDOR_NEW, page="", bff_page=""):
    t = Tree()
    t.write("network/apis/vendor-connectivity/openapi.yaml", vendor_copy)
    t.write("storefront/apis/storefront-bff/openapi.yaml", BFF_NEW)
    t.write("network/docs/contexts/vendor-connectivity/index.md", page)
    t.write("storefront/docs/contexts/storefront-bff/index.md", bff_page)
    files = {("vendor-connectivity", "apis/openapi.yaml"): VENDOR_NEW,
             ("storefront-bff", "apis/openapi.yaml"): BFF_NEW}
    return t, files


def classes(findings):
    return sorted({(f["class"], f["text"]) for f in findings})


class SpecCopies(unittest.TestCase):
    def test_equal_copy_is_clean(self):
        t, files = make()
        findings, _ = dd.run(t.root, fetcher(files))
        self.assertEqual(findings, [])

    def test_stale_copy_is_spec_drift(self):
        old = VENDOR_NEW.replace(b"/vendors/{vendorId}/suspensions", b"/vendors/{vendorId}:suspend")
        t, files = make(vendor_copy=old)
        findings, _ = dd.run(t.root, fetcher(files))
        self.assertEqual([f["class"] for f in findings], ["spec-drift"])
        self.assertEqual(findings[0]["ctx"], "vendor-connectivity")

    def test_copy_without_producer_file_is_spec_missing(self):
        t, files = make()
        del files[("vendor-connectivity", "apis/openapi.yaml")]
        findings, _ = dd.run(t.root, fetcher(files))
        self.assertIn("spec-missing", [f["class"] for f in findings])

    def test_unreadable_producer_is_not_a_pass(self):
        t, files = make()
        with self.assertRaises(dd.Unreadable):
            dd.run(t.root, fetcher(files, unreadable={"storefront-bff"}))
        rc = dd.main(["--root", str(t.root), "--from-dir", str(t.root / "nowhere")])
        self.assertEqual(rc, dd.EXIT_UNREADABLE)


class RoutesAndVocabulary(unittest.TestCase):
    def run_pages(self, page="", bff_page=""):
        t, files = make(page=page, bff_page=bff_page)
        return dd.run(t.root, fetcher(files))[0]

    def test_current_routes_pass(self):
        f = self.run_pages("Suspend with `POST /vendors/{vendorId}/suspensions`.\n"
                           "| GET | `/vendor/purchase-orders` |\n")
        self.assertEqual(f, [])

    def test_retired_vendor_connectivity_suspend_route_goes_red(self):
        f = self.run_pages("Suspend with `POST /vendors/{vendorId}:suspend`.\n")
        self.assertEqual(classes(f), [("route-missing", "POST /vendors/{vendorId}:suspend")])
        self.assertEqual(f[0]["ctx"], "vendor-connectivity")
        self.assertEqual(f[0]["line"], 1)

    def test_retired_storefront_bff_routes_go_red(self):
        page = ("```bash\n"
                "curl -X POST http://localhost:8080/orders/$ID:cancel\n"
                "curl -X POST \\\n  -H 'Idempotency-Key: k' \\\n  http://localhost:8080/checkout/$ID:confirm\n"
                "```\n"
                "Quote with POST /carts/{id}/delivery:quote then select.\n"
                "Fine: `POST /orders/{id}/cancellations`.\n")
        f = self.run_pages(bff_page=page)
        got = {x["text"] for x in f}
        self.assertEqual(got, {"POST /orders/$ID:cancel", "POST /checkout/$ID:confirm",
                               "POST /carts/{id}/delivery:quote"})
        self.assertTrue(all(x["ctx"] == "storefront-bff" for x in f))

    def test_curl_without_method_is_a_get_and_data_makes_it_a_post(self):
        page = "```\ncurl http://h/vendor/purchase-orders\ncurl -d '{}' http://h/vendors/1/suspensions\n```\n"
        self.assertEqual(self.run_pages(page), [])
        page = "```\ncurl http://h/vendors/1/suspensions\n```\n"  # GET on a POST-only path
        self.assertEqual([x["class"] for x in self.run_pages(page)], ["route-missing"])

    def test_explicit_context_prefix_is_strict(self):
        page = "`storefront-bff: POST /vendors/{vendorId}/suspensions` is a sibling's route.\n"
        f = self.run_pages(page)
        self.assertEqual(f[0]["ctx"], "storefront-bff")

    def test_sibling_route_without_prefix_is_accepted(self):
        self.assertEqual(self.run_pages("Calls `POST /orders/{id}/cancellations` upstream.\n"), [])

    def test_nextToken_goes_red_only_when_the_spec_adopted_the_guideline(self):
        f = self.run_pages("The list answers `nextToken` for the next page.\n")
        self.assertEqual(classes(f), [("retired-shape", "nextToken")])
        t, files = make(page="The list answers `nextToken`.\n")
        legacy = VENDOR_NEW.replace(b"Idempotency-Key", b"X-Key").replace(b"nextCursor", b"cursor")
        files[("vendor-connectivity", "apis/openapi.yaml")] = legacy
        t.write("network/apis/vendor-connectivity/openapi.yaml", legacy)
        self.assertEqual(dd.run(t.root, fetcher(files))[0], [])

    def test_x_action_id_and_list_envelope_vocabulary(self):
        f = self.run_pages("Send `X-Action-Id` with each call.\n"
                           'Body: { "purchaseOrders": [] }\n')
        self.assertEqual(sorted(x["text"] for x in f),
                         ["X-Action-Id", "purchaseOrders list envelope"])

    def test_bare_colon_verb_path_is_retired_shape(self):
        f = self.run_pages("The old route was /vendors/{vendorId}:suspend and is gone.\n")
        self.assertEqual([(x["class"]) for x in f], ["retired-shape"])

    def test_allow_marker_line_block_and_file(self):
        bad = "POST /vendors/{vendorId}:suspend"
        self.assertEqual(self.run_pages(f"`{bad}` {{/* drift-allow: kept for the migration table */}}\n"), [])
        self.assertEqual(self.run_pages(f"{{/* drift-allow: history table */}}\n```\n{bad}\n\n{bad}\n```\n"), [])
        self.assertEqual(self.run_pages(f"{{/* drift-allow-file: migration page */}}\n`{bad}`\n"), [])
        # a marker covers only its own block
        f = self.run_pages(f"{{/* drift-allow: x */}}\n`{bad}`\n\n`{bad}`\n")
        self.assertEqual([x["line"] for x in f], [4])

    def test_sentence_that_says_the_shape_is_gone_is_not_a_citation(self):
        bad = "`POST /vendors/{vendorId}:suspend`"
        self.assertEqual(self.run_pages(f"{bad} no longer exists; `nextToken` was retired.\n"), [])
        self.assertEqual(len(self.run_pages(f"{bad} suspends a vendor.\n")), 1)

    def test_allowlist_filters_and_goes_stale(self):
        f = [dd.finding("route-missing", "x", "docs/a.md", 3, "POST /x", "d")]
        entry = {"file": "docs/a.md", "class": "route-missing", "text": "POST /x", "reason": "external"}
        kept, stale = dd.apply_allowlist(f, [entry])
        self.assertEqual((kept, stale), ([], []))
        kept, stale = dd.apply_allowlist([], [entry])
        self.assertEqual([s["class"] for s in stale], ["allow-stale"])
        kept, stale = dd.apply_allowlist(f, [dict(entry, text="POST /y")])
        self.assertEqual(len(kept), 1)
        self.assertEqual(len(stale), 1)

    def test_historical_fence_is_skipped(self):
        bad = "POST /vendors/{vendorId}:suspend"
        self.assertEqual(self.run_pages(f"```http historical\n{bad}\n```\n"), [])
        self.assertEqual(len(self.run_pages(f"```http\n{bad}\n```\n")), 1)

    def test_adr_bodies_and_generated_reference_are_not_scanned(self):
        t, files = make()
        bad = "`POST /vendors/{vendorId}:suspend`\n"
        t.write("network/docs/adr/0001-x.md", bad)
        t.write("docs/api-reference/rest/x/y.api.mdx", bad)
        self.assertEqual(dd.run(t.root, fetcher(files))[0], [])
        t.write("network/docs/strategic-design/x.md", bad)
        f = dd.run(t.root, fetcher(files))[0]
        self.assertEqual([(x["ctx"], x["file"]) for x in f], [("(fleet)", "network/docs/strategic-design/x.md")])

    def test_page_without_owner_must_match_some_context(self):
        t, files = make()
        t.write("docs/overview.md", "`POST /vendors/{id}/suspensions` ok, `POST /nope/{id}/zap` not.\n")
        f = dd.run(t.root, fetcher(files))[0]
        self.assertEqual([x["text"] for x in f], ["POST /nope/{id}/zap"])

    def test_infra_endpoints_are_not_flagged(self):
        self.assertEqual(self.run_pages("Probe `GET /healthz`, `GET /readyz`, `GET /metrics`.\n"), [])


if __name__ == "__main__":
    unittest.main()
