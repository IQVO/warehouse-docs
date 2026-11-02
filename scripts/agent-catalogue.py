#!/usr/bin/env python3
"""Fleet agent catalogue: every MCP tool and A2A skill with its authority level.

Agentic Standard v2 (AS-1, AS-3, AS-6). The registry (docs/architecture/agent-catalogue.json)
is built OFFLINE from sources that each repo already pins in CI, so no cluster is needed:

  * MCP tools   - the repo's internal/adapters/inbound/mcp/testdata/tool_registry.golden
                  (TSV: name, readOnly, destructive[, authority]) or .golden.json
                  (the tools/list payload; authority is _meta["com.warehouse/authority"]).
  * MCP surface - git grep counts of AddResource / AddResourceTemplate / AddPrompt.
  * A2A skills  - docs/architecture/a2a-agents.json (tag "authority:L<n>"; the card registry is
                  refreshed from live cards by a2a-cards.py --write).

usage:
  agent-catalogue.py --refresh [ROOT] [--fetch]  rebuild the registry + page from ROOT/<repo> (origin/develop;
                                        --fetch runs git fetch in each repo first)
  agent-catalogue.py --check-page       registry and page agree, page is MDX-safe (docs CI)
  agent-catalogue.py --check-authority  exit 1 unless every tool/skill declares a level and every
                                        MCP server has a resource and a prompt (rollout gate)
  agent-catalogue.py --report           print the adoption summary

ROOT defaults to $WAREHOUSE_ROOT or the parent of this repository. Stdlib only.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
REGISTRY = HERE / "docs/architecture/agent-catalogue.json"
PAGE = HERE / "docs/architecture/agent-catalogue.md"
A2A_REGISTRY = HERE / "docs/architecture/a2a-agents.json"
MCP_DIR = "internal/adapters/inbound/mcp"
GOLDENS = (f"{MCP_DIR}/testdata/tool_registry.golden.json", f"{MCP_DIR}/testdata/tool_registry.golden")
META_KEY = "com.warehouse/authority"
LEVELS = ("L1", "L2", "L3", "L4")
BRANCHES = ("origin/develop", "origin/main")
# MCP-only agents (no A2A card) that still belong in the catalogue.
EXTRA_CONTEXTS = ("warehouse-ops-agent",)


def git(repo: Path, *args: str) -> str | None:
    p = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else None


def branch_of(repo: Path) -> str | None:
    for b in BRANCHES:
        if git(repo, "rev-parse", "-q", "--verify", b) is not None:
            return b
    return None


def parse_tsv(text: str) -> list[dict]:
    tools = []
    for line in text.splitlines():
        cols = line.split("\t")
        if len(cols) < 3 or not cols[0].strip():
            continue
        auth = cols[3].strip() if len(cols) > 3 and cols[3].strip() in LEVELS else None
        tools.append({"name": cols[0].strip(), "readOnly": cols[1] == "true", "destructive": cols[2] == "true", "authority": auth})
    return tools


def parse_json(text: str) -> list[dict]:
    data = json.loads(text)
    if isinstance(data, dict):
        data = data.get("tools", [])
    tools = []
    for t in data:
        ann = t.get("annotations") or {}
        auth = (t.get("_meta") or {}).get(META_KEY)
        tools.append({
            "name": t["name"],
            "readOnly": bool(ann.get("readOnlyHint")),
            "destructive": bool(ann.get("destructiveHint")),
            "authority": auth if auth in LEVELS else None,
        })
    return tools


def mcp_entry(repo: Path, branch: str) -> dict | None:
    tools = None
    for g in GOLDENS:
        text = git(repo, "show", f"{branch}:{g}")
        if text is not None:
            tools = parse_json(text) if g.endswith(".json") else parse_tsv(text)
            break
    exists = git(repo, "ls-tree", "-r", "--name-only", branch, MCP_DIR + "/")
    if tools is None and not exists:
        return None
    count = lambda pat: len((git(repo, "grep", "-hE", pat, branch, "--", MCP_DIR, ":!*_test.go") or "").splitlines())
    return {
        "tools": sorted(tools, key=lambda t: t["name"]) if tools is not None else None,
        "resources": count(r"\.AddResource(Template)?\("),
        "prompts": count(r"\.AddPrompt\("),
    }


def a2a_entry(a2a: dict | None) -> dict | None:
    if not a2a:
        return None
    skills = []
    for s in a2a.get("skills", []):
        auth = next((t.split(":", 1)[1] for t in s.get("tags", []) if t.startswith("authority:") and t.split(":", 1)[1] in LEVELS), None)
        skills.append({"id": s["id"], "kind": s.get("kind", "read"), "authority": auth})
    return {"skills": skills}


def load_a2a() -> dict:
    return json.loads(A2A_REGISTRY.read_text()).get("agents", {})


def build_registry(root: Path) -> dict:
    a2a = load_a2a()
    names = sorted(set(a2a) | set(EXTRA_CONTEXTS))
    reg: dict = {"contexts": {}}
    for n in names:
        repo = root / n
        mcp = None
        if (repo / ".git").exists() or (repo / ".git").is_file():
            b = branch_of(repo)
            mcp = mcp_entry(repo, b) if b else None
        reg["contexts"][n] = {"mcp": mcp, "a2a": a2a_entry(a2a.get(n))}
    return reg


def load_registry() -> dict:
    return json.loads(REGISTRY.read_text())


def level_counts(items: list[dict]) -> str:
    c = {l: sum(1 for i in items if i.get("authority") == l) for l in LEVELS}
    parts = [f"{l} {n}" for l, n in c.items() if n]
    return ", ".join(parts) if parts else "none declared"


def stats(reg: dict) -> dict:
    s = {"contexts": 0, "mcp_servers": 0, "tools": 0, "tools_declared": 0, "skills": 0, "skills_declared": 0, "complete_surface": 0}
    for c in reg["contexts"].values():
        s["contexts"] += 1
        m, a = c.get("mcp"), c.get("a2a")
        if m:
            s["mcp_servers"] += 1
            tools = m["tools"] or []
            s["tools"] += len(tools)
            s["tools_declared"] += sum(1 for t in tools if t["authority"])
            if m["resources"] and m["prompts"]:
                s["complete_surface"] += 1
        if a:
            s["skills"] += len(a["skills"])
            s["skills_declared"] += sum(1 for k in a["skills"] if k["authority"])
    return s


def render(reg: dict) -> str:
    s = stats(reg)
    out = [
        "---",
        "title: Agent catalogue",
        "sidebar_label: Agent catalogue",
        'description: "Every MCP tool and A2A skill in the fleet with its authority level (L1 inform to L4 act within an envelope), and which MCP servers offer resources and prompts. Generated from the repositories pinned tool registries and the A2A card index."',
        "---",
        "",
        "# Agent catalogue",
        "",
        "{/* GENERATED by scripts/agent-catalogue.py from agent-catalogue.json. Do not edit by hand:",
        "    run scripts/agent-catalogue.py --refresh, then commit both files. */}",
        "",
        "The Agentic Standard v2 asks every MCP tool and A2A skill to declare an authority level, and every MCP",
        "server to offer tools, at least one resource and at least one prompt. This page tracks adoption.",
        "",
        "| Level | Meaning |",
        "|---|---|",
        "| L1 | inform: reads facts, changes nothing |",
        "| L2 | recommend: returns a proposal, changes nothing |",
        "| L3 | act on approval: changes state behind a human confirmation |",
        "| L4 | act within an envelope enforced by the owning domain, granted by an ADR |",
        "",
        "## Adoption",
        "",
        "| Measure | Declared | Total |",
        "|---|---|---|",
        f"| MCP tools with an authority level | {s['tools_declared']} | {s['tools']} |",
        f"| A2A skills with an authority level | {s['skills_declared']} | {s['skills']} |",
        f"| MCP servers with a resource and a prompt | {s['complete_surface']} | {s['mcp_servers']} |",
        "",
        "## By context",
        "",
        "| Context | MCP tools | MCP levels | Resources | Prompts | A2A skills | A2A levels |",
        "|---|---|---|---|---|---|---|",
    ]
    for n, c in sorted(reg["contexts"].items()):
        m, a = c.get("mcp"), c.get("a2a")
        if m:
            tools = m["tools"]
            mt = str(len(tools)) if tools is not None else "no pinned registry"
            ml = level_counts(tools) if tools is not None else "unknown"
            mr, mp = str(m["resources"]), str(m["prompts"])
        else:
            mt, ml, mr, mp = "no MCP server", "-", "-", "-"
        if a:
            at, al = str(len(a["skills"])), level_counts(a["skills"])
        else:
            at, al = "no A2A agent", "-"
        out.append(f"| `{n}` | {mt} | {ml} | {mr} | {mp} | {at} | {al} |")
    out += ["", "## Tools that change state", "",
            "Write tools are L3 unless the owning context's ADR grants L4.", "",
            "| Context | Tool | Level |", "|---|---|---|"]
    rows = 0
    for n, c in sorted(reg["contexts"].items()):
        m = c.get("mcp")
        for t in (m["tools"] or []) if m else []:
            if not t["readOnly"]:
                out.append(f"| `{n}` | `{t['name']}` | {t['authority'] or 'not declared'} |")
                rows += 1
    if not rows:
        out.append("| - | - | - |")
    return "\n".join(out) + "\n"


def mdx_problems(text: str) -> list[str]:
    bad = []
    if "<!--" in text:
        bad.append("HTML comment; use a braces comment")
    body = re.sub(r"`[^`]*`", "", text)
    body = re.sub(r"\{/\*.*?\*/\}", "", body, flags=re.S)
    for m in re.finditer(r"[<{]", body):
        bad.append(f"bare {m.group(0)!r} outside a code span")
        break
    return bad


def cmd_refresh(root: Path) -> int:
    reg = build_registry(root)
    REGISTRY.write_text(json.dumps(reg, indent=2) + "\n")
    PAGE.write_text(render(reg))
    s = stats(reg)
    print(f"wrote {REGISTRY.name} and {PAGE.name}: {s['tools_declared']}/{s['tools']} tools, "
          f"{s['skills_declared']}/{s['skills']} skills declared; {s['complete_surface']}/{s['mcp_servers']} servers with resource+prompt")
    return 0


def cmd_check_page() -> int:
    reg = load_registry()
    want = render(reg)
    have = PAGE.read_text() if PAGE.exists() else ""
    probs = mdx_problems(have)
    if have != want:
        probs.append("page differs from the registry: run scripts/agent-catalogue.py --refresh and commit both files")
    if probs:
        print("agent catalogue check FAILED:\n  " + "\n  ".join(probs))
        return 1
    print("agent catalogue page matches registry")
    return 0


def cmd_check_authority() -> int:
    reg = load_registry()
    miss = []
    for n, c in sorted(reg["contexts"].items()):
        m, a = c.get("mcp"), c.get("a2a")
        if m:
            if m["tools"] is None:
                miss.append(f"{n}: MCP server has no pinned tool registry golden, so its tools cannot be catalogued")
            for t in m["tools"] or []:
                if not t["authority"]:
                    miss.append(f"{n}: MCP tool {t['name']} has no authority level")
                elif not t["readOnly"] and t["authority"] in ("L1", "L2"):
                    miss.append(f"{n}: write tool {t['name']} is {t['authority']} (must be L3 or L4)")
            if not (m["resources"] and m["prompts"]):
                miss.append(f"{n}: MCP server lacks a resource or a prompt (resources={m['resources']}, prompts={m['prompts']})")
        if a:
            for k in a["skills"]:
                if not k["authority"]:
                    miss.append(f"{n}: A2A skill {k['id']} has no authority tag")
                elif k["kind"] == "write" and k["authority"] in ("L1", "L2"):
                    miss.append(f"{n}: write skill {k['id']} is {k['authority']} (must be L3 or L4)")
    if miss:
        print(f"{len(miss)} authority finding(s):\n  " + "\n  ".join(miss))
        return 1
    print("every tool and skill declares a valid level; every MCP server has a resource and a prompt")
    return 0


def cmd_report() -> int:
    s = stats(load_registry())
    print(json.dumps(s, indent=2))
    return 0


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    cmd = argv[0]
    if cmd == "--refresh":
        args = [a for a in argv[1:] if a != "--fetch"]
        root = Path(args[0] if args else os.environ.get("WAREHOUSE_ROOT") or HERE.parent)
        if "--fetch" in argv:
            for d in sorted(root.iterdir()):
                if (d / ".git").exists() and not d.name.startswith("wt-"):
                    git(d, "fetch", "-q", "origin")
        return cmd_refresh(root)
    if cmd == "--check-page":
        return cmd_check_page()
    if cmd == "--check-authority":
        return cmd_check_authority()
    if cmd == "--report":
        return cmd_report()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
