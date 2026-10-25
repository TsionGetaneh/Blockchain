from __future__ import annotations

import argparse
import json
from pathlib import Path


def list_blacklisted_addresses(data_dir: Path, category_filter: str | None = None, search: str | None = None) -> list[dict]:
    flagged_file = data_dir / "flagged_addresses.json"
    if not flagged_file.exists():
        print("[!] No flagged addresses file found.")
        return []

    data = json.loads(flagged_file.read_text(encoding="utf-8"))
    results: list[dict] = []

    for chain, items in data.items():
        if not isinstance(items, list):
            continue
        for item in items:
            cat = item.get("category", "unknown").lower()
            addr = item.get("address", "").lower()
            
            target_cat = category_filter.lower() if category_filter else None
            if target_cat == "ofac" and cat not in ["ofac", "sanctioned"]:
                continue
            elif target_cat and target_cat != "ofac" and cat != target_cat:
                continue
            if search and search.lower() not in addr and search.lower() not in item.get("label", "").lower():
                continue

            results.append({
                "chain": chain,
                "address": item.get("address"),
                "category": item.get("category"),
                "label": item.get("label"),
                "source": item.get("source"),
                "risk_weight": item.get("risk_weight", item.get("score", 85)),
                "confidence": item.get("confidence", 1.0),
            })

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="List and filter all blacklisted / darknet / OFAC addresses in database")
    parser.add_argument("--category", choices=["darknet", "ofac", "phishing", "ransomware", "stolen_funds", "mixer", "exchange"], help="Filter by category")
    parser.add_argument("--search", help="Search string (address or label)")

    args = parser.parse_args()

    data_dir = Path(__file__).resolve().parent.parent / "data"
    results = list_blacklisted_addresses(data_dir, category_filter=args.category, search=args.search)

    print(f"\n=======================================================")
    print(f"  Blacklisted / Threat Intelligence Database ({len(results)} Entries)")
    print(f"=======================================================\n")

    for i, item in enumerate(results[:50], 1):
        print(f"[{i}] Chain: {item['chain'].upper()} | Category: {item['category'].upper()} | Weight: {item['risk_weight']}")
        print(f"    Address: {item['address']}")
        print(f"    Label:   {item['label']} (Source: {item['source']})")
        print("-" * 55)

    if len(results) > 50:
        print(f"\n... and {len(results) - 50} more entries.")

    print(f"\nTotal Matching Entries: {len(results)}\n")


if __name__ == "__main__":
    main()
