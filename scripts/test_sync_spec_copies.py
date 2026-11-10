#!/usr/bin/env python3
"""Offline tests for scripts/sync-spec-copies.py: after a sync the gate's spec-copy check is clean."""
import atexit
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("ssc", Path(__file__).with_name("sync-spec-copies.py"))
assert spec and spec.loader
ssc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ssc)
gate = ssc.load_gate()


def fetcher(files, unreadable=()):
    def fetch(repo, path):
        if repo in unreadable:
            raise gate.Unreadable(f"{repo}: boom")
        if (repo, path) not in files:
            raise gate.NotFound(f"{repo}:{path}")
        return files[(repo, path)]

    return fetch


class SyncSpecCopies(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="sync-test-"))
        atexit.register(shutil.rmtree, self.root, True)
        for rel, text in {"apis/order-management/openapi.yaml": b"old\n",
                          "apis/order-management/asyncapi.yaml": b"same\n",
                          "network/apis/order-sourcing/openapi.yaml": b"same\n",
                          "yard/apis/dock-scheduling/asyncapi.yaml": b"dropped upstream\n"}.items():
            p = self.root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(text)
        self.dev = {("order-management", "apis/openapi.yaml"): b"new: see [x](/docs/adr/0001)\n",
                    ("order-management", "apis/asyncapi.yaml"): b"same\n",
                    ("order-management", "apis/openapi-reports.yaml"): b"reports\n",
                    ("order-sourcing", "apis/openapi.yaml"): b"same\n",
                    ("order-sourcing", "apis/asyncapi.yaml"): b"not carried by the network section\n"}

    def test_rewrites_exactly_what_the_gate_expects(self):
        changed, orphaned = ssc.sync(self.root, gate, fetcher(self.dev))
        self.assertEqual(changed, ["apis/order-management/openapi-reports.yaml", "apis/order-management/openapi.yaml"])
        self.assertEqual(orphaned, ["yard/apis/dock-scheduling/asyncapi.yaml"])
        self.assertEqual((self.root / "apis/order-management/openapi.yaml").read_bytes(),
                         b"new: see [x](https://iqvo.github.io/order-management/docs/adr/0001)\n")
        self.assertFalse((self.root / "network/apis/order-sourcing/asyncapi.yaml").exists())
        contexts = gate.discover_contexts(self.root)
        findings = gate.check_spec_copies(self.root, contexts, gate.fetch_develop(
            [c for c in contexts if not c.get("route_only")], fetcher(self.dev)) | {
            "warehouse-ops-agent": {}, "payment-provider-simulator": {}})
        # the only finding left is the copy whose producer dropped the file: a human decides that one
        self.assertEqual([(f["class"], f["file"]) for f in findings],
                         [("spec-missing", "yard/apis/dock-scheduling/asyncapi.yaml")])

    def test_second_run_is_a_no_op(self):
        ssc.sync(self.root, gate, fetcher(self.dev))
        self.assertEqual(ssc.sync(self.root, gate, fetcher(self.dev))[0], [])

    def test_unreadable_producer_writes_nothing(self):
        with self.assertRaises(gate.Unreadable):
            ssc.sync(self.root, gate, fetcher(self.dev, unreadable={"order-sourcing"}))
        self.assertEqual((self.root / "apis/order-management/openapi.yaml").read_bytes(), b"old\n")


if __name__ == "__main__":
    unittest.main()
