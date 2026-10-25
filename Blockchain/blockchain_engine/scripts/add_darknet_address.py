from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

VALID_CATEGORIES = {
    "darknet",
    "ofac",
    "phishing",
    "ransomware",
    "stolen_funds",
    "mixer",
    "exchange",
}


def add_flagged_address(
    data_dir: Path,
    address: str,
    chain: str,
    category: str,
    label: str,
    source: str,
    risk_weight: int,
    confidence: float,
    sync_backend: bool = True,
) -> dict:
    flagged_file = data_dir / "flagged_addresses.json"
    
    if not flagged_file.exists():
        data = {"global": []}
    else:
        try:
            data = json.loads(flagged_file.read_text(encoding="utf-8"))
        except Exception:
            data = {"global": []}

    chain_key = chain.lower()
    if chain_key not in data:
        data[chain_key] = []

    address_clean = address.strip()
    
    # Remove existing entry if present
    data[chain_key] = [
        item for item in data[chain_key]
        if item.get("address", "").lower() != address_clean.lower()
    ]

    entry = {
        "address": address_clean,
        "category": category.lower(),
        "source": source,
        "label": label or f"{category.upper()} flagged address",
        "confidence": confidence,
        "risk_weight": risk_weight,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    data[chain_key].append(entry)

    # Save to flagged_addresses.json
    flagged_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"[+] Added address to Python Threat Database: {address_clean} ({category.upper()})")

    # Optionally sync to NestJS backend database API
    if sync_backend:
        try:
            backend_url = "http://localhost:3000/api/v1/flagged/add"
            payload = json.dumps({
                "address": address_clean,
                "chain": chain_key.lower(),
                "reason": f"[{category.upper()}] {label} (Source: {source})",
                "source": source,
                "hopDistance": 1,
            }).encode("utf-8")
            
            req = urllib.request.Request(
                backend_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status in (200, 201):
                    print(f"[+] Successfully synced {address_clean} to NestJS Backend DB!")
        except Exception as err:
            print(f"[!] Backend sync notice: NestJS backend not reachable on 3000 ({err}). Saved locally in Python engine.")

    return entry


def main() -> None:
    parser = argparse.ArgumentParser(description="Add darknet, OFAC, phishing, or blacklisted address to database")
    parser.add_argument("--address", required=True, help="Wallet address to flag")
    parser.add_argument("--chain", default="ethereum", help="Blockchain network (ethereum, bitcoin, bsc, polygon, etc.)")
    parser.add_argument("--category", default="darknet", choices=VALID_CATEGORIES, help="Threat category")
    parser.add_argument("--label", default="", help="Short description / label (e.g. SilkRoad Vendor)")
    parser.add_argument("--source", default="Analyst Research", help="Intelligence source")
    parser.add_argument("--risk-weight", type=int, default=85, help="Risk score points (0-100)")
    parser.add_argument("--confidence", type=float, default=0.9, help="Confidence rating (0.0 to 1.0)")

    args = parser.parse_args()

    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    add_flagged_address(
        data_dir=data_dir,
        address=args.address,
        chain=args.chain,
        category=args.category,
        label=args.label,
        source=args.source,
        risk_weight=args.risk_weight,
        confidence=args.confidence,
    )


if __name__ == "__main__":
    main()
