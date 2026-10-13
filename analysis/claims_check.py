"""Evidence check for the context claims shown next to each site (TypeSafe / Jev).

Each site in sites.yaml carries one short `context` claim and a `source`. analysis/sources/<id>.txt
stores a verbatim passage (or abstract) from that source with its URL and retrieval date.

    1. Deterministic gate: the excerpt file exists, names the same source URL, and has real text.
    2. One TypeSafe Choice question per claim: does the excerpt support, contradict, or say nothing
       about the claim? (Pattern from the TypeSafe "Double-checking citations" cookbook.)
    3. Confidence gate: only `supports` at confidence >= THRESHOLD becomes "supported"; everything
       else is routed to human review. Nothing here touches the numeric similarity scores.

    python claims_check.py            # needs TYPESAFE_API_KEY in the environment (never printed)
    python claims_check.py --offline  # writes "not checked" results without calling the API

Output: frontend/public/data/claims.v1.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
OUT = ROOT.parent / "frontend" / "public" / "data" / "claims.v1.json"
THRESHOLD = 0.8
MODEL = "jev-latest"
MIN_EXCERPT_CHARS = 120

INSTRUCTIONS = {
    "task": "How does `source_excerpt` relate to `claim`? Judge only from the excerpt, not from outside knowledge.",
    "note": "A claim counts as supported only if the excerpt states it or directly implies every part of it.",
}
CRITERIA = {
    "supports": "The excerpt states the claim or directly implies that every part of it is true.",
    "contradicts": "The excerpt states the opposite of the claim, or implies part of it is false.",
    "says_nothing": "The excerpt does not address what the claim asserts, or supports only part of it.",
}


def read_excerpt(site_id: str) -> tuple[dict, str] | None:
    path = SOURCES / f"{site_id}.txt"
    if not path.exists():
        return None
    head, _, body = path.read_text(encoding="utf-8").partition("\n---\n")
    meta = dict(line.split(": ", 1) for line in head.splitlines() if ": " in line)
    return meta, body.strip()


def gate(site: dict) -> tuple[str | None, str | None]:
    """Returns (excerpt, reason_if_not_checkable)."""
    if not site.get("context"):
        return None, "no claim"
    if not site.get("source"):
        return None, "no source cited"
    found = read_excerpt(site["id"])
    if found is None:
        return None, "no stored source excerpt"
    meta, body = found
    if meta.get("source") != site["source"]:
        return None, "stored excerpt is from a different source"
    if len(body) < MIN_EXCERPT_CHARS:
        return None, "stored excerpt too short to judge"
    return body, None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    sites = yaml.safe_load((ROOT / "sites.yaml").read_text(encoding="utf-8"))["sites"]
    key_present = bool(os.environ.get("TYPESAFE_API_KEY"))
    client = None
    if key_present and not args.offline:
        from typesafe_sdk import TypeSafeClient

        client = TypeSafeClient(timeout=60.0)  # reads TYPESAFE_API_KEY itself

    results: dict[str, dict] = {}
    model_used = None
    for s in sites:
        excerpt, reason = gate(s)
        entry = {"claim": s.get("context"), "source": s.get("source")}
        if reason:
            results[s["id"]] = {**entry, "status": "not_checked", "reason": reason}
            continue
        if client is None:
            results[s["id"]] = {**entry, "status": "not_checked", "reason": "offline run" if args.offline else "no API key configured"}
            continue
        from typesafe_sdk import Choice, TypeSafeError

        try:
            resp = client.system_one(
                state={"claim": s["context"], "source_excerpt": excerpt},
                questions={"relation": Choice(instructions=INSTRUCTIONS, criteria=CRITERIA)},
                model=MODEL,
            )
        except TypeSafeError as err:
            results[s["id"]] = {**entry, "status": "not_checked", "reason": f"API error: {type(err).__name__}"}
            continue
        ans = resp.answers["relation"]
        model_used = resp.model
        if ans.choice == "supports" and ans.confidence >= THRESHOLD:
            status = "supported"
        elif ans.choice == "contradicts" and ans.confidence >= THRESHOLD:
            status = "contradicted"
        else:
            status = "needs_review"
        results[s["id"]] = {
            **entry,
            "status": status,
            "relation": ans.choice,
            "confidence": round(float(ans.confidence), 4),
            "probabilities": {k: round(float(v), 4) for k, v in ans.probabilities.items()},
        }
        print(f"{s['id']:<18} {ans.choice:<13} conf {ans.confidence:.2f} -> {status}")

    doc = {
        "version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "checker": "TypeSafe System One Choice (supports / contradicts / says_nothing)",
        "model": model_used,
        "threshold": THRESHOLD,
        "scope": "Context claims only. Similarity scores are computed deterministically and never use this check.",
        "results": results,
    }
    args.out.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    counts: dict[str, int] = {}
    for r in results.values():
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("summary:", counts, "model:", model_used)


if __name__ == "__main__":
    main()
