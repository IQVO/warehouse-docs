#!/usr/bin/env python3
"""Fleet A2A card index: generate, and check for drift.

The fleet's A2A agents (one per bounded context) each serve an Agent Card at
/api/a2a/<context>/.well-known/agent-card.json behind Kong. This tool keeps
docs/architecture/a2a-agents.json (the registry) and the page generated from
it (docs/architecture/a2a-agents.md) in step with those live cards.

  a2a-cards.py --write BASE      fetch every registered agent's live card from
                                 BASE (e.g. http://localhost:8000), rewrite the
                                 registry JSON and the page
  a2a-cards.py --check-page      OFFLINE: the committed page must equal the page
                                 rendered from the committed registry (docs CI)
  a2a-cards.py --check-live BASE LIVE: every live card must equal its registry
                                 entry; exits 1 and prints the drift otherwise.
                                 Needs a cluster
  a2a-cards.py --probe BASE      LIVE: every REGISTERED agent answers through the
                                 gateway on both mounts (/ and /a2a), declares no
                                 security schemes, names itself, and answers an
                                 unknown skill as an in-band 400 problem (not a
                                 JSON-RPC error). Run after any apply

The card's `version` is the deployed image tag and changes on every release, so
it is deliberately NOT part of the registry or the comparison.
Stdlib only.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "docs" / "architecture" / "a2a-agents.json"
PAGE = ROOT / "docs" / "architecture" / "a2a-agents.md"

# Editorial map of the fleet: which tier each context's agent belongs to.
# A context appears here the moment it is meant to have an agent; if its card is
# unreachable at --write time it is listed as "not exposed yet" instead.
TIERS = {
    "WMS": ["inventory-storage", "product-master", "facility-layout", "slotting-optimization",
            "inbound-receiving", "pick-face-replenishment"],
    "WES": ["wes-work-planning", "fulfillment-execution", "workforce-management", "labor-performance",
            "task-interleaving", "process-path-management", "warehouse-planning"],
    "Retail network": ["order-management", "network-fulfillment", "node-topology", "node-performance",
                       "network-inventory-planning", "order-sourcing", "delivery-promise",
                       "offer-availability", "seller-inbound", "vendor-connectivity", "linehaul-transportation",
                       "last-mile-delivery", "shipping-and-tracking", "returns-processing", "pricing"],
    "E-commerce": ["checkout", "customer-ordering", "customer-payments", "shopping-cart",
                   "product-content", "product-discovery"],
    "Cross-cutting": ["exception-management"],
}
ALL_AGENTS = [a for agents in TIERS.values() for a in agents]


def fetch_card(base: str, agent: str):
    url = f"{base.rstrip('/')}/api/a2a/{agent}/.well-known/agent-card.json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.load(r)
    except (urllib.error.URLError, OSError, ValueError):
        return None


def entry(card: dict) -> dict:
    """The stable, version-free projection of a card that the registry stores."""
    return {
        "name": card["name"],
        "description": card["description"],
        "interface": card["supportedInterfaces"][0]["url"],
        "binding": card["supportedInterfaces"][0]["protocolBinding"],
        "streaming": bool(card.get("capabilities", {}).get("streaming")),
        "securitySchemes": card.get("securitySchemes"),
        "skills": [
            {
                "id": s["id"],
                "name": s["name"],
                "kind": "write" if "write" in s.get("tags", []) else "read",
                "description": s["description"],
                "tags": s.get("tags", []),
                "examples": s.get("examples", []),
            }
            for s in card["skills"]
        ],
    }


def load_registry() -> dict:
    return json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {"agents": {}}


def mdx_text(text: str) -> str:
    """Card prose lands in an MDX page: braces would be evaluated as JavaScript and a bare < starts JSX."""
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("<", "&lt;")


def first_sentence(text: str) -> str:
    cut = text.find(". ")
    return mdx_text((text[: cut + 1] if cut != -1 else text).strip())


def render(reg: dict) -> str:
    agents = reg["agents"]
    out = [
        "---",
        "title: A2A agents",
        "sidebar_label: A2A agents",
        'description: "Fleet index of the Agent2Agent (A2A) agents: one per bounded context, with their skills, read or write, and gateway routes. Generated from the live Agent Cards."',
        "---",
        "",
        "# A2A agents",
        "",
        "{/* GENERATED by scripts/a2a-cards.py from a2a-agents.json. Do not edit by hand:",
        "    change a context's card, then run scripts/a2a-cards.py --write <gateway>. */}",
        "",
        "Every bounded context exposes one Agent2Agent agent, so another context's agent can",
        "**delegate a goal** to it. Three transports carry three different things and do not",
        "overlap:",
        "",
        "| Transport | Carries |",
        "|---|---|",
        "| Kafka + CloudEvents | **facts** between contexts |",
        "| MCP | an agent's **tools** |",
        "| A2A | the **delegation** of a goal; never data sync (delegate out, facts back via CloudEvents) |",
        "",
        "The rules are in the fleet rule `agents/fleet/a2a.md`. In short: at most two curated,",
        "goal-shaped skills per agent; a write skill exists only where the context's MCP surface",
        "already offers that write; endpoints are unauthenticated like REST and MCP; problems",
        "are answered in-band as RFC 7807 problems with the REST adapter's status classification.",
        "",
        "Cards are served at `/api/a2a/<context>/.well-known/agent-card.json` through the Kong",
        "gateway; the JSON-RPC endpoint is the same prefix (`POST /api/a2a/<context>/`, header",
        "`A2A-Version: 1.0`). A request is a data part",
        '`{"skill": "<id>", "arguments": {...}}`.',
        "",
    ]
    exposed = sum(1 for a in agents.values() if a)
    writes = sum(1 for a in agents.values() if a for s in a["skills"] if s["kind"] == "write")
    out += [f"**{exposed} agents exposed, {writes} write skills.**", ""]
    for tier, names in TIERS.items():
        out += [f"## {tier}", "", "| Agent | Skills | Route |", "|---|---|---|"]
        for n in names:
            a = agents.get(n)
            if not a:
                out.append(f"| `{n}` | _not exposed yet_ | - |")
                continue
            sk = ", ".join(f"`{s['id']}` ({s['kind']})" for s in a["skills"])
            out.append(f"| `{n}` | {sk} | `/api/a2a/{n}` |")
        out.append("")
    out += ["## Skills", ""]
    for tier, names in TIERS.items():
        for n in names:
            a = agents.get(n)
            if not a:
                continue
            out += [f"### {n}", "", first_sentence(a["description"]), ""]
            for s in a["skills"]:
                out.append(f"- **`{s['id']}`** ({s['kind']}): {first_sentence(s['description'])}")
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def cmd_write(base: str) -> int:
    reg = {"agents": {}}
    missing = []
    for n in ALL_AGENTS:
        card = fetch_card(base, n)
        reg["agents"][n] = entry(card) if card else None
        if not card:
            missing.append(n)
    REGISTRY.write_text(json.dumps(reg, indent=2, sort_keys=False) + "\n")
    PAGE.write_text(render(reg))
    print(f"wrote {REGISTRY.name} and {PAGE.name}: {len(ALL_AGENTS) - len(missing)} exposed, {len(missing)} not reachable {missing}")
    return 0


def mdx_problems(text: str) -> list:
    """Docusaurus compiles these pages as MDX v3: HTML comments and autolinks are compile errors."""
    import re
    out = []
    if "<!--" in text:
        out.append("contains an HTML comment (<!--); use an MDX comment {/* ... */}")
    body = re.sub(r"\{/\*.*?\*/\}", "", text, flags=re.S)       # the generator's own MDX comment
    body = re.sub(r"```.*?```", "", body, flags=re.S)             # fenced code
    body = re.sub(r"`[^`\n]*`", "", body)                          # inline code
    for n, line in enumerate(body.split("\n"), 1):
        if re.search(r"(?<!\\)[{}]", line):
            out.append(f"unescaped brace outside code (MDX evaluates it as JavaScript): {line.strip()[:70]!r}")
            break
    return out


def cmd_check_page() -> int:
    want = render(load_registry())
    have = PAGE.read_text() if PAGE.exists() else ""
    bad = mdx_problems(want)
    if bad:
        print("generated page is not valid MDX: " + "; ".join(bad), file=sys.stderr)
        return 1
    if want != have:
        print("docs/architecture/a2a-agents.md is out of step with a2a-agents.json; run scripts/a2a-cards.py --write <gateway>", file=sys.stderr)
        return 1
    print("page matches registry")
    return 0


def rpc(url: str, skill: str) -> dict:
    body = {"jsonrpc": "2.0", "id": 1, "method": "SendMessage",
            "params": {"message": {"messageId": "probe", "role": "ROLE_USER",
                                   "parts": [{"data": {"skill": skill, "arguments": {}}}]}}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "A2A-Version": "1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def cmd_probe(base: str) -> int:
    reg = load_registry()["agents"]
    bad = []
    for n, want in reg.items():
        if not want:
            continue
        card = fetch_card(base, n)
        if not card:
            bad.append(f"{n}: card unreachable through the gateway")
            continue
        if card["name"] != n:
            bad.append(f"{n}: card names itself {card['name']!r}")
        if card.get("securitySchemes"):
            bad.append(f"{n}: declares security schemes (the fleet is unauthenticated by decision)")
        for mount in ("/", "/a2a"):
            url = f"{base.rstrip('/')}/api/a2a/{n}{mount}"
            try:
                msg = rpc(url, "no_such_skill")["result"]["message"]
                problem = msg["parts"][0]["data"]["problem"]
                if problem["status"] != 400:
                    bad.append(f"{n}{mount}: unknown skill answered status {problem['status']}, want 400")
            except Exception as e:  # noqa: BLE001 - report any failure mode
                bad.append(f"{n}{mount}: no in-band problem for an unknown skill ({type(e).__name__}: {e})")
    if bad:
        print("A2A probe failures:\n  " + "\n  ".join(bad), file=sys.stderr)
        return 1
    print(f"probe ok: {sum(1 for v in reg.values() if v)} agents, both mounts")
    return 0


def cmd_check_live(base: str) -> int:
    reg = load_registry()["agents"]
    drift = []
    for n in ALL_AGENTS:
        card = fetch_card(base, n)
        have = entry(card) if card else None
        want = reg.get(n)
        if have == want:
            continue
        if want is None:
            drift.append(f"{n}: live card exists but the registry says 'not exposed yet'")
        elif have is None:
            drift.append(f"{n}: registered, but the live card is unreachable")
        else:
            for k in sorted(set(have) | set(want)):
                if have.get(k) != want.get(k):
                    drift.append(f"{n}: field '{k}' differs from the registry")
    if drift:
        print("A2A card drift:\n  " + "\n  ".join(drift), file=sys.stderr)
        return 1
    print(f"no drift: {sum(1 for v in reg.values() if v)} cards match the registry")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 3 and argv[1] == "--write":
        return cmd_write(argv[2])
    if len(argv) == 2 and argv[1] == "--check-page":
        return cmd_check_page()
    if len(argv) >= 3 and argv[1] == "--check-live":
        return cmd_check_live(argv[2])
    if len(argv) >= 3 and argv[1] == "--probe":
        return cmd_probe(argv[2])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
