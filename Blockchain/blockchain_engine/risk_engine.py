
from __future__ import annotations

import json
from pathlib import Path

from blockchain_engine.models import (
    Detection,
    NormalizedTransaction,
    RiskResult,
    ScreeningResult,
)


class RiskEngine:

    CATEGORY_WEIGHTS = {
        "sanctioned": 60,
        "mixer": 50,
        "ransomware": 50,
        "ransomware_related": 45,
        "stolen_funds": 45,
        "darknet": 40,
        "phishing": 35,
        "reported_ransomware": 30,
        "exchange": 10,
    }

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.flagged_db_path = self.data_dir / "flagged_addresses.json"


    def evaluate(
        self,
        chain: str,
        address: str,
        transactions: list[NormalizedTransaction],
        detections: list[Detection],
        entity_label: str = "user wallet",
        screening: ScreeningResult | None = None,
    ) -> RiskResult:

        score = 0
        reasons: list[str] = []
        evidence: list[dict[str, object]] = []

        flagged_db = self._load_flagged_db()
        address_key = address.lower()

        matched_categories = set()
        signal_sources: set[str] = set()


        if screening and screening.matches:
            for match in screening.matches:
                category = match.category or "unknown"
                source = match.source or "screening"
                label = match.label or category
                record_score = match.score
                if category not in matched_categories:
                    matched_categories.add(category)
                    score += self.CATEGORY_WEIGHTS.get(category, record_score)
                    reason = f"{category.upper()} detected from {source}"
                    reasons.append(reason)
                    evidence.append({
                        "category": category,
                        "source": source,
                        "score": record_score,
                        "label": label,
                        "confidence": round(min(1.0, record_score / 100), 2),
                        "description": reason,
                    })

        # =====================================
        # 1. External Intelligence Database
        # =====================================

        records = (
            flagged_db.get(chain, [])
            +
            flagged_db.get("global", [])
        )


        for record in records:
            if record["address"].lower() != address_key:
                continue

            category = record.get("category", "unknown")
            source = record.get("source", "feed")
            label = record.get("label") or category
            record_score = int(record.get("risk_weight", record.get("score", 50)))
            confidence_value = float(record.get("confidence", min(1.0, record_score / 100)))

            if category not in matched_categories:
                matched_categories.add(category)
                score += self.CATEGORY_WEIGHTS.get(category, record_score)
                reason = f"{category.upper()} detected from {source}"
                reasons.append(reason)
                evidence.append({
                    "category": category,
                    "source": source,
                    "score": record_score,
                    "label": label,
                    "confidence": round(confidence_value, 2),
                    "description": reason,
                })
            elif source not in signal_sources:
                # Add additional evidence from the same category if source differs
                signal_sources.add(source)
                evidence.append({
                    "category": category,
                    "source": source,
                    "score": record_score,
                    "label": label,
                    "confidence": round(confidence_value * 0.8, 2),
                    "description": f"Additional {category} signal from {source}",
                })


        # =====================================
        # 2. Transaction Behavior
        # =====================================


        unique_counterparties = {
            str(tx.to_address).lower()
            for tx in transactions
            if tx.to_address
            and str(tx.to_address).lower() != address_key
        }


        if len(unique_counterparties) >= 12:
            score += 10
            reasons.append("High number of unique counterparties")
            evidence.append({
                "category": "behavior",
                "source": "behavioral_heuristic",
                "score": 10,
                "label": "high_counterparty_count",
                "confidence": 0.45,
                "description": "Interacts with a large number of unique addresses",
            })

        if len(transactions) >= 15:
            score += 10
            reasons.append("High transaction activity")
            evidence.append({
                "category": "behavior",
                "source": "behavioral_heuristic",
                "score": 10,
                "label": "high_frequency",
                "confidence": 0.45,
                "description": "Sustained high transaction volume",
            })


        # =====================================
        # 3. Money Flow Analysis
        # =====================================


        outgoing_ratio = self._outgoing_ratio(transactions)


        if outgoing_ratio > 0.9:
            score += 10
            reasons.append("Mostly outgoing transaction pattern")
            evidence.append({
                "category": "behavior",
                "source": "flow_analysis",
                "score": 10,
                "label": "high_outgoing_ratio",
                "confidence": 0.5,
                "description": "Funds are primarily flowing out of the wallet",
            })


        # =====================================
        # 4. Fast Fund Movement
        # =====================================


        if self._detect_fast_movement(transactions):
            score += 15
            reasons.append("Funds moved quickly after receiving")
            evidence.append({
                "category": "behavior",
                "source": "flow_analysis",
                "score": 15,
                "label": "fast_fund_movement",
                "confidence": 0.7,
                "description": "Received funds were spent rapidly, consistent with layering behavior",
            })


        # =====================================
        # 5. Detection Engine Results
        # =====================================


        detection_labels = {
            item.label
            for item in detections
        }


        if "approval" in detection_labels:
            score += 5
            reasons.append("Token approval interaction detected")
            evidence.append({
                "category": "behavior",
                "source": "detector",
                "score": 5,
                "label": "approval",
                "confidence": 0.4,
                "description": "ERC20 approval / contract authorization seen",
            })

        if "tornado_cash" in detection_labels:
            score += 50
            reasons.append("Mixer protocol interaction detected")
            evidence.append({
                "category": "mixer",
                "source": "detector",
                "score": 50,
                "label": "tornado_cash",
                "confidence": 0.95,
                "description": "Known Tornado Cash mixer address interaction",
            })

        if "bridge" in detection_labels:
            score += 10
            reasons.append("Bridge/chain-hop interaction detected")
            evidence.append({
                "category": "chain_hop",
                "source": "detector",
                "score": 10,
                "label": "bridge",
                "confidence": 0.75,
                "description": "Bridge contract interaction detected",
            })

        if "dex_swap" in detection_labels:
            score += 5
            reasons.append("DEX swap interaction detected")
            evidence.append({
                "category": "contract_interaction",
                "source": "detector",
                "score": 5,
                "label": "dex_swap",
                "confidence": 0.55,
                "description": "Swap interaction with decentralized exchange",
            })

        if "multicall" in detection_labels:
            score += 5
            reasons.append("Multicall / advanced contract batching detected")
            evidence.append({
                "category": "contract_interaction",
                "source": "detector",
                "score": 5,
                "label": "multicall",
                "confidence": 0.45,
                "description": "Multicall batching behavior detected",
            })

        if "large_transfer" in detection_labels:
            score += 8
            reasons.append("Large transaction detected")
            evidence.append({
                "category": "transaction_size",
                "source": "detector",
                "score": 8,
                "label": "large_transfer",
                "confidence": 0.5,
                "description": "A single large transfer was observed",
            })


        # =====================================
        # 6. Entity Classification
        # =====================================


        if entity_label == "bot":
            score += 10
            reasons.append("Bot-like wallet behavior")
            evidence.append({
                "category": "entity",
                "source": "entity_classification",
                "score": 10,
                "label": "bot",
                "confidence": 0.6,
                "description": "Address exhibits bot-like timing and interaction patterns",
            })

        elif entity_label == "mixer":
            score += 15
            reasons.append("Wallet classified as mixer")
            evidence.append({
                "category": "entity",
                "source": "entity_classification",
                "score": 15,
                "label": "mixer",
                "confidence": 0.8,
                "description": "Address is classified as a mixer based on protocol interaction",
            })

        elif entity_label == "exchange":
            score += 10
            reasons.append("Exchange-like wallet behavior detected")
            evidence.append({
                "category": "entity",
                "source": "entity_classification",
                "score": 10,
                "label": "exchange",
                "confidence": 0.7,
                "description": "High-volume, multi-counterparty behavior consistent with exchange activity",
            })


        # =====================================
        # Final Risk Score
        # =====================================


        score = min(score, 100)

        if score >= 70:
            label = "high_risk"
        elif score >= 40:
            label = "suspicious"
        else:
            label = "low_risk"

        evidence_scores = [float(item.get("score", 0)) for item in evidence]
        evidence_confidences = [float(item.get("confidence", 0.0)) for item in evidence]
        max_confidence = max(evidence_confidences, default=0.2)
        confidence = min(
            1.0,
            max_confidence * 0.75 + min(1.0, len(evidence) / 5) * 0.18 + 0.1,
        )
        if score >= 80:
            confidence = max(confidence, 0.8)
        if score >= 95:
            confidence = max(confidence, 0.9)

        categories = sorted(matched_categories)

        return RiskResult(
            address=address,
            chain=chain,
            score=score,
            reasons=list(dict.fromkeys(reasons)),
            label=label,
            risk_level=label,
            confidence=round(confidence, 2),
            categories=categories,
            evidence=evidence,
            entity_label=entity_label,
            detections=detections,
            transactions=transactions,
        )



    def _detect_fast_movement(
        self,
        transactions: list[NormalizedTransaction]
    ) -> bool:


        if len(transactions) < 2:
            return False


        txs = sorted(
            transactions,
            key=lambda x: x.timestamp
        )


        for i in range(len(txs)-1):

            first = txs[i]
            second = txs[i + 1]


            if (
                first.direction == "in"
                and
                second.direction == "out"
            ):

                seconds = (
                    second.timestamp - first.timestamp
                ).total_seconds()


                if 0 < seconds < 600:
                    return True


        return False



    def _load_flagged_db(self) -> dict:

        if not self.flagged_db_path.exists():

            return {
                "global": []
            }


        try:

            return json.loads(
                self.flagged_db_path.read_text(
                    encoding="utf-8"
                )
            )

        except Exception:

            return {
                "global": []
            }



    @staticmethod
    def _outgoing_ratio(
        transactions: list[NormalizedTransaction]
    ) -> float:

        if not transactions:
            return 0.0

        # Filter for value-bearing transactions first to avoid zero-value approvals skewing ratio
        value_txs = [tx for tx in transactions if (tx.value or 0) > 0]
        eval_txs = value_txs if value_txs else transactions

        outgoing = sum(
            1
            for tx in eval_txs
            if tx.direction == "out"
        )

        return outgoing / len(eval_txs)

