#!/usr/bin/env python3
"""Offline tests for scripts/pin-drift-report.py (injected fetchers, no network, no gh)."""
import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("pdr", Path(__file__).with_name("pin-drift-report.py"))
pdr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdr)

SPEC_V1 = "openapi: 3.0.3\n# header comment\ninfo: {title: x, version: 1}\npaths:\n  /a: {get: {}}\n"
SPEC_V2 = "openapi: 3.0.3\n# header comment\ninfo: {title: x, version: 1}\npaths:\n  /a: {get: {}}\n  /b: {get: {}}\n"
SPEC_COMMENT = SPEC_V1.replace("# header comment", "# a reworded comment") + "\n"


def pin(producer, path="apis/openapi.yaml", local=None, ref="develop"):
    name = producer.split("/")[-1]
    return {"local": local or f"testdata/{name}.yaml", "repo": producer, "path": path, "ref": ref}


def pinned(*pins):
    return json.dumps({"_doc": "x", "pins": list(pins)})


class FakeFleet:
    """files: {(repo, path, ref): text}; a missing key is a 404 (None). `fail` raises ApiError."""

    def __init__(self, files, fail=None):
        self.files, self.fail, self.calls = files, fail, []

    def __call__(self, repo, path, ref):
        self.calls.append((repo, path, ref))
        if self.fail and self.fail(repo, path, ref):
            raise pdr.ApiError("boom")
        return self.files.get((repo, path, ref))


def fleet():
    p1, p2 = pin("IQVO/prod-a"), pin("IQVO/prod-b", "apis/asyncapi.yaml")
    return FakeFleet({
        # consumer-x: one clean pin, one drifted (schema change) pin
        ("IQVO/consumer-x", "contracts/pinned.json", "develop"): pinned(p1, p2),
        ("IQVO/consumer-x", p1["local"], "develop"): SPEC_V1,
        ("IQVO/prod-a", "apis/openapi.yaml", "develop"): SPEC_V1,
        ("IQVO/consumer-x", p2["local"], "develop"): SPEC_V1,
        ("IQVO/prod-b", "apis/asyncapi.yaml", "develop"): SPEC_V2,
        # consumer-y: comment-only drift on prod-a, plus a SELF pin that drifted
        ("IQVO/consumer-y", "contracts/pinned.json", "develop"):
            pinned(pin("IQVO/prod-a", local="y/a.yaml"), pin("IQVO/consumer-y", "apis/asyncapi.yaml", "y/self.yaml")),
        ("IQVO/consumer-y", "y/a.yaml", "develop"): SPEC_COMMENT,
        ("IQVO/consumer-y", "y/self.yaml", "develop"): SPEC_V1,
        # consumer-z: producer path deleted -> unreadable
        ("IQVO/consumer-z", "contracts/pinned.json", "develop"): pinned(pin("IQVO/gone", "apis/gone.yaml", "z/g.yaml")),
        ("IQVO/consumer-z", "z/g.yaml", "develop"): SPEC_V1,
        # consumer-w: malformed pinned.json
        ("IQVO/consumer-w", "contracts/pinned.json", "develop"): "{not json",
        # self-pin target on consumer-y's own producer side
        ("IQVO/consumer-y", "apis/asyncapi.yaml", "develop"): SPEC_V2,
    })


REPOS = ["consumer-w", "consumer-x", "consumer-y", "consumer-z", "no-pins-repo"]


class ParsePins(unittest.TestCase):
    def test_valid(self):
        pins, err = pdr.parse_pins(pinned(pin("IQVO/a")))
        self.assertIsNone(err)
        self.assertEqual(len(pins), 1)

    def test_bad_json_no_list_missing_field(self):
        for text in ("{x", "[]", json.dumps({"pins": "no"}), json.dumps({"pins": [{"local": "a"}]})):
            pins, err = pdr.parse_pins(text)
            self.assertEqual(pins, [])
            self.assertTrue(err, text)


class DiffStat(unittest.TestCase):
    def test_counts_and_not_cosmetic(self):
        s = pdr.diff_stat(SPEC_V1, SPEC_V2)
        self.assertEqual((s["added"], s["removed"], s["cosmetic"]), (1, 0, False))

    def test_comment_and_blank_only_is_cosmetic(self):
        s = pdr.diff_stat(SPEC_V1, SPEC_COMMENT)
        self.assertTrue(s["cosmetic"])
        self.assertGreater(s["added"] + s["removed"], 0)

    def test_trailing_whitespace_is_cosmetic(self):
        self.assertTrue(pdr.diff_stat("a: 1\n", "a: 1  \n")["cosmetic"])

    def test_removed_and_changed_lines(self):
        s = pdr.diff_stat("a: 1\nb: 2\n", "a: 1\nb: 3\nc: 4\n")
        self.assertEqual((s["added"], s["removed"]), (2, 1))


class CheckPin(unittest.TestCase):
    def test_ok_drift_unreadable(self):
        f = fleet()
        ok = pdr.check_pin("consumer-x", pin("IQVO/prod-a"), f)
        self.assertEqual(ok["status"], "ok")
        drift = pdr.check_pin("consumer-x", pin("IQVO/prod-b", "apis/asyncapi.yaml"), f)
        self.assertEqual(drift["status"], "drift")
        self.assertEqual(drift["stat"]["added"], 1)
        gone = pdr.check_pin("consumer-z", pin("IQVO/gone", "apis/gone.yaml", "z/g.yaml"), f)
        self.assertEqual(gone["status"], "unreadable")
        self.assertIn("producer file missing", gone["reason"])

    def test_pin_copy_missing(self):
        f = FakeFleet({("IQVO/p", "apis/openapi.yaml", "develop"): SPEC_V1})
        r = pdr.check_pin("c", pin("IQVO/p", local="nope.yaml"), f)
        self.assertEqual(r["status"], "unreadable")
        self.assertIn("pin copy missing", r["reason"])

    def test_self_flag_and_pin_ref_used(self):
        f = FakeFleet({("IQVO/c", "x.yaml", "develop"): SPEC_V1, ("IQVO/c", "apis/openapi.yaml", "v1.2"): SPEC_V2})
        r = pdr.check_pin("c", pin("IQVO/c", local="x.yaml", ref="v1.2"), f)
        self.assertTrue(r["self"])
        self.assertEqual(r["status"], "drift")
        self.assertIn(("IQVO/c", "apis/openapi.yaml", "v1.2"), f.calls)


class ScanRepo(unittest.TestCase):
    def test_repo_without_pinned_json_is_skipped(self):
        self.assertIsNone(pdr.scan_repo("no-pins-repo", fleet()))

    def test_malformed_pinned_json_is_unreadable_not_a_crash(self):
        n, bad = pdr.scan_repo("consumer-w", fleet())
        self.assertEqual(n, 0)
        self.assertEqual(bad[0]["status"], "unreadable")
        self.assertIn("not valid JSON", bad[0]["reason"])


class BuildReport(unittest.TestCase):
    def setUp(self):
        self.r = pdr.build_report(REPOS, fleet(), workers=4)

    def test_summary(self):
        s = self.r["summary"]
        self.assertEqual((s["repos_scanned"], s["repos_with_pins"], s["pins"]), (5, 4, 5))
        self.assertEqual((s["drifted_pins"], s["drifted_consumers"], s["unreadable_pins"]), (3, 2, 2))
        self.assertFalse(self.r["clean"])

    def test_group_by_producer(self):
        bp = {(g["producer"], g["path"]): g["consumers"] for g in self.r["by_producer"]}
        self.assertEqual(bp[("IQVO/prod-a", "apis/openapi.yaml")], ["consumer-y"])
        self.assertEqual(bp[("IQVO/prod-b", "apis/asyncapi.yaml")], ["consumer-x"])
        self.assertEqual(bp[("IQVO/consumer-y", "apis/asyncapi.yaml")], ["consumer-y"])
        self.assertEqual(list(bp), sorted(bp))

    def test_group_by_consumer_and_self(self):
        bc = {g["consumer"]: g["pins"] for g in self.r["by_consumer"]}
        self.assertEqual(list(bc), ["consumer-x", "consumer-y"])
        self.assertEqual([p["self"] for p in bc["consumer-y"]], [True, False])
        cosmetic = {p["local"]: p["cosmetic"] for p in bc["consumer-y"]}
        self.assertTrue(cosmetic["y/a.yaml"])
        self.assertFalse(cosmetic["y/self.yaml"])

    def test_deterministic_across_worker_counts_and_repo_order(self):
        a = pdr.render_markdown(pdr.build_report(REPOS, fleet(), workers=1))
        b = pdr.render_markdown(pdr.build_report(list(reversed(REPOS)), fleet(), workers=8))
        self.assertEqual(a, b)
        self.assertEqual(a, pdr.render_markdown(self.r))

    def test_clean_fleet(self):
        f = FakeFleet({("IQVO/c", "contracts/pinned.json", "develop"): pinned(pin("IQVO/p", local="l.yaml")),
                       ("IQVO/c", "l.yaml", "develop"): SPEC_V1, ("IQVO/p", "apis/openapi.yaml", "develop"): SPEC_V1})
        r = pdr.build_report(["c", "other"], f)
        self.assertTrue(r["clean"])
        md = pdr.render_markdown(r)
        self.assertIn("Status: CLEAN", md)
        self.assertNotIn("## Refresh", md)
        self.assertIn("None.", md)

    def test_api_failure_propagates(self):
        f = FakeFleet({}, fail=lambda *a: True)
        with self.assertRaises(pdr.ApiError):
            pdr.build_report(["c"], f)


class Markdown(unittest.TestCase):
    def test_sections_and_flags(self):
        md = pdr.render_markdown(pdr.build_report(REPOS, fleet()))
        for needle in ("Status: DRIFT", "3 drifted pin(s) in 2 consumer(s)", "## Drifted pins by producer",
                       "### `IQVO/prod-a` `apis/openapi.yaml` — 1 consumer(s)", "## Drifted pins by consumer",
                       "## Unreadable pins", "producer file missing", "not valid JSON", "(comments/whitespace only)",
                       "| SELF |", "## Refresh", "consumer-contract-testing.md#refresh-runbook"):
            self.assertIn(needle, md)
        self.assertNotIn("no-pins-repo", md)

    def test_unreadable_section_precedes_nothing_when_only_unreadable(self):
        f = FakeFleet({("IQVO/c", "contracts/pinned.json", "develop"): pinned(pin("IQVO/p", local="l.yaml")),
                       ("IQVO/c", "l.yaml", "develop"): SPEC_V1})
        md = pdr.render_markdown(pdr.build_report(["c"], f))
        self.assertNotIn("## Drifted pins by producer", md)
        self.assertIn("## Unreadable pins", md)
        self.assertIn("Status: DRIFT", md)


class Main(unittest.TestCase):
    def test_exit_codes_and_json(self):
        import contextlib
        import io
        import os
        import tempfile
        orig = (pdr.list_repos, pdr.read_file)
        try:
            pdr.list_repos, pdr.read_file = (lambda: REPOS), fleet()
            out = io.StringIO()
            with tempfile.TemporaryDirectory() as d, contextlib.redirect_stdout(out):
                path = os.path.join(d, "r.json")
                self.assertEqual(pdr.main(["--json", path]), 0)  # drift is reported, not a failure
                with open(path) as fh:
                    data = json.load(fh)
            self.assertFalse(data["clean"])
            self.assertIn("# Pin drift report", out.getvalue())

            def broken():
                raise pdr.ApiError("no auth")
            pdr.list_repos = broken
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                self.assertEqual(pdr.main([]), 2)
            self.assertIn("no auth", err.getvalue())
        finally:
            pdr.list_repos, pdr.read_file = orig


if __name__ == "__main__":
    unittest.main()
