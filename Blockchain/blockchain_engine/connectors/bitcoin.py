from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import requests

from blockchain_engine.connectors.base import BaseConnector
from blockchain_engine.models import NormalizedTransaction
from blockchain_engine.network import RetryConfig, request_with_retry


class BitcoinConnector(BaseConnector):
    chain = "bitcoin"

    def __init__(
        self,
        api_url: str = "https://blockstream.info/api",
        request_timeout: int = 20,
        retry_config: RetryConfig | None = None,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.request_timeout = request_timeout
        self.session = requests.Session()
        self.retry_config = retry_config or RetryConfig()

    def _get(self, path: str) -> Any:
        if path.startswith("http"):
            full_url = path
        else:
            path_clean = path if path.startswith("/") else f"/{path}"
            full_url = f"{self.api_url}{path_clean}"

        response = request_with_retry(
            self.session,
            "GET",
            full_url,
            timeout=self.request_timeout,
            retry_config=self.retry_config,
        )
        response.raise_for_status()
        return response.json()

    def get_balance(self, address: str) -> dict[str, Any]:
        # Try Blockstream / Mempool.space API format
        try:
            url = f"{self.api_url}/address/{address}"
            data = self._get(url)
            chain_stats = data.get("chain_stats", {})
            mempool_stats = data.get("mempool_stats", {})
            funded = chain_stats.get("funded_txo_sum", 0) + mempool_stats.get("funded_txo_sum", 0)
            spent = chain_stats.get("spent_txo_sum", 0) + mempool_stats.get("spent_txo_sum", 0)
            balance_btc = (funded - spent) / 10**8
            return {
                "chain": self.chain,
                "address": address,
                "balance": max(0.0, balance_btc),
                "asset": "BTC",
            }
        except Exception:
            pass

        # Fallback to Blockchain.info format
        try:
            data = self._get(f"https://blockchain.info/rawaddr/{address}?limit=1")
            balance_btc = data.get("final_balance", 0) / 10**8
            return {
                "chain": self.chain,
                "address": address,
                "balance": balance_btc,
                "asset": "BTC",
            }
        except Exception as exc:
            print(f"[Bitcoin] get_balance error for {address}: {exc}")
            return {
                "chain": self.chain,
                "address": address,
                "balance": 0.0,
                "asset": "BTC",
            }

    def get_transactions(
        self,
        address: str,
        limit: int = 50,
    ) -> list[NormalizedTransaction]:
        lower_address = address.lower()
        results: list[NormalizedTransaction] = []

        # 1. Try Blockstream API
        try:
            url = f"{self.api_url}/address/{address}/txs"
            txs = self._get(url)
            if isinstance(txs, list):
                for tx in txs[:limit]:
                    txid = tx.get("txid") or tx.get("hash")
                    if not txid:
                        continue

                    input_addrs: list[str] = []
                    input_val = 0
                    for vin in tx.get("vin", []):
                        prevout = vin.get("prevout") or {}
                        inp_addr = (prevout.get("scriptpubkey_address") or "").lower()
                        if inp_addr:
                            input_addrs.append(inp_addr)
                        input_val += prevout.get("value", 0)

                    output_addrs: list[str] = []
                    rec_val = 0
                    for vout in tx.get("vout", []):
                        out_addr = (vout.get("scriptpubkey_address") or "").lower()
                        val = vout.get("value", 0)
                        if out_addr:
                            output_addrs.append(out_addr)
                        if out_addr == lower_address:
                            rec_val += val

                    if lower_address in output_addrs:
                        direction = "in"
                        value_sats = rec_val
                    elif lower_address in input_addrs:
                        direction = "out"
                        value_sats = input_val
                    else:
                        direction = "in"
                        value_sats = rec_val

                    status = tx.get("status") or {}
                    block_time = status.get("block_time")
                    block_num = status.get("block_height")

                    if block_time:
                        timestamp = datetime.fromtimestamp(block_time, tz=timezone.utc)
                    else:
                        timestamp = datetime.now(timezone.utc)

                    from_addr = input_addrs[0] if input_addrs else ""
                    to_addr = address if direction == "in" else (output_addrs[0] if output_addrs else None)

                    results.append(
                        NormalizedTransaction(
                            chain=self.chain,
                            tx_hash=txid,
                            block_number=block_num,
                            timestamp=timestamp,
                            from_address=from_addr,
                            to_address=to_addr,
                            value=value_sats / 10**8,
                            asset="BTC",
                            direction=direction,
                            method_id=None,
                            raw=tx,
                        )
                    )

                if results:
                    print(f"[Bitcoin] Blockstream API returned {len(results)} txs for {address}")
                    return results[:limit]
        except Exception as exc:
            print(f"[Bitcoin] Blockstream API failed: {exc}, trying fallback...")

        # 2. Fallback to Blockchain.info
        try:
            url = f"https://blockchain.info/rawaddr/{address}?limit={min(limit, 50)}"
            data = self._get(url)
            txs = data.get("txs", [])
            for tx in txs:
                txid = tx.get("hash")
                if not txid:
                    continue
                input_addrs = [
                    (vin.get("prev_out") or {}).get("addr", "").lower()
                    for vin in tx.get("inputs", [])
                    if (vin.get("prev_out") or {}).get("addr")
                ]
                output_addrs = [
                    (vout.get("addr") or "").lower()
                    for vout in tx.get("out", [])
                    if vout.get("addr")
                ]
                direction = "in" if lower_address in output_addrs else "out"
                rec_val = sum(
                    vout.get("value", 0)
                    for vout in tx.get("out", [])
                    if (vout.get("addr") or "").lower() == lower_address
                )
                value_sats = rec_val if direction == "in" else sum(vout.get("value", 0) for vout in tx.get("out", []))

                tx_time = tx.get("time")
                timestamp = datetime.fromtimestamp(tx_time, tz=timezone.utc) if tx_time else datetime.now(timezone.utc)

                results.append(
                    NormalizedTransaction(
                        chain=self.chain,
                        tx_hash=txid,
                        block_number=tx.get("block_height"),
                        timestamp=timestamp,
                        from_address=input_addrs[0] if input_addrs else "",
                        to_address=address if direction == "in" else (output_addrs[0] if output_addrs else None),
                        value=value_sats / 10**8,
                        asset="BTC",
                        direction=direction,
                        method_id=None,
                        raw=tx,
                    )
                )
        except Exception as exc:
            print(f"[Bitcoin] Blockchain.info API error: {exc}")

        return results[:limit]

    def get_code(self, address: str) -> str:
        return ""