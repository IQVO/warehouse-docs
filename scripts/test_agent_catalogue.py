#!/usr/bin/env python3
"""Unit tests for agent-catalogue.py (stdlib unittest)."""
import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("ac", Path(__file__).with_name("agent-catalogue.py"))
ac = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ac)


class Parse(unittest.TestCase):
    def test_tsv_with_and_without_authority(self):
        t = ac.parse_tsv("assign_labor\tfalse\ttrue\tL3\nget_x\ttrue\tfalse\n")
        self.assertEqual(t[0], {"name": "assign_labor", "readOnly": False, "destructive": True, "authority": "L3"})
        self.assertIsNone(t[1]["authority"])

    def test_tsv_rejects_unknown_level(self):
        self.assertIsNone(ac.parse_tsv("a\ttrue\tfalse\tL9\n")[0]["authority"])

    def test_json_meta_authority(self):
        raw = json.dumps([{"name": "a", "annotations": {"readOnlyHint": True}, "_meta": {ac.META_KEY: "L1"}},
                          {"name": "b", "annotations": {"destructiveHint": True}}])
        t = ac.parse_json(raw)
        self.assertEqual((t[0]["readOnly"], t[0]["authority"]), (True, "L1"))
        self.assertEqual((t[1]["readOnly"], t[1]["destructive"], t[1]["authority"]), (False, True, None))

    def test_a2a_authority_from_tags(self):
        e = ac.a2a_entry({"skills": [{"id": "s", "kind": "write", "tags": ["write", "authority:L3"]}, {"id": "r", "tags": []}]})
        self.assertEqual([k["authority"] for k in e["skills"]], ["L3", None])


def reg(tools, res=1, prm=1, skills=None):
    return {"contexts": {"c": {"mcp": {"tools": tools, "resources": res, "prompts": prm},
                               "a2a": {"skills": skills or []}}}}


class Gates(unittest.TestCase):
    def check(self, r):
        ac.REGISTRY = Path(self.id() + ".json")
        ac.REGISTRY.write_text(json.dumps(r))
        try:
            return ac.cmd_check_authority()
        finally:
            ac.REGISTRY.unlink()

    def test_clean(self):
        t = [{"name": "w", "readOnly": False, "destructive": True, "authority": "L3"}]
        self.assertEqual(self.check(reg(t)), 0)

    def test_missing_level_fails(self):
        t = [{"name": "w", "readOnly": True, "destructive": False, "authority": None}]
        self.assertEqual(self.check(reg(t)), 1)

    def test_write_tool_at_l1_fails(self):
        t = [{"name": "w", "readOnly": False, "destructive": False, "authority": "L1"}]
        self.assertEqual(self.check(reg(t)), 1)

    def test_missing_prompt_fails(self):
        t = [{"name": "w", "readOnly": True, "destructive": False, "authority": "L1"}]
        self.assertEqual(self.check(reg(t, prm=0)), 1)

    def test_write_skill_at_l2_fails(self):
        t = [{"name": "w", "readOnly": True, "destructive": False, "authority": "L1"}]
        self.assertEqual(self.check(reg(t, skills=[{"id": "s", "kind": "write", "authority": "L2"}])), 1)

    def test_unpinned_registry_fails(self):
        self.assertEqual(self.check(reg(None)), 1)


class Page(unittest.TestCase):
    def test_render_is_mdx_safe_and_stable(self):
        r = reg([{"name": "w", "readOnly": False, "destructive": True, "authority": "L3"}])
        text = ac.render(r)
        self.assertEqual(ac.mdx_problems(text), [])
        self.assertEqual(text, ac.render(r))
        self.assertIn("| `c` | `w` | L3 |", text)

    def test_mdx_problems_detects_comment_and_brace(self):
        self.assertTrue(ac.mdx_problems("<!-- x -->"))
        self.assertTrue(ac.mdx_problems("see {id} here"))
        self.assertEqual(ac.mdx_problems("see `{id}` here"), [])


if __name__ == "__main__":
    unittest.main()
