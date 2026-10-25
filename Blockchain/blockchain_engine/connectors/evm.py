from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import requests

from blockchain_engine.connectors.base import BaseConnector
from blockchain_engine.models import NormalizedTransaction
from blockchain_engine.network import RetryConfig, request_with_retry


TRANSFER_EVENT_TOPIC = (
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
)


class EVMConnector(BaseConnector):

    def __init__(
        self,
        chain: str,
        rpc_url: str,
        request_timeout: int = 20,
        explorer_api_url: str | None = None,
        explorer_api_key: str = "",
        blockscout_api_url: str | None = None,
        alchemy_api_key: str = "",
        max_rpc_scan_blocks: int = 250,
        retry_config: RetryConfig | None = None,
    ) -> None:

        self.chain = chain.lower()
        self.rpc_url = rpc_url
        self.request_timeout = request_timeout

        self.explorer_api_url = explorer_api_url
        self.explorer_api_key = explorer_api_key

        self.blockscout_api_url = (
            blockscout_api_url.rstrip("/")
            if blockscout_api_url
            else None
        )

        self.alchemy_api_key = alchemy_api_key
        self.max_rpc_scan_blocks = max_rpc_scan_blocks

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        })

        self.retry_config = (
            retry_config
            or RetryConfig()
        )

    # =========================================================
    # RPC
    # =========================================================

    def _rpc(
        self,
        method: str,
        params: list[Any],
    ) -> Any:

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }

        response = request_with_retry(
            self.session,
            "POST",
            self.rpc_url,
            json=payload,
            timeout=self.request_timeout,
            retry_config=self.retry_config,
        )

        response.raise_for_status()

        body = response.json()

        if body.get("error"):
            raise RuntimeError(
                f"{self.chain} RPC error: {body['error']}"
            )

        return body["result"]

    # =========================================================
    # EXPLORER
    # =========================================================

    def _explorer_get(
        self,
        params: dict[str, Any],
    ) -> Any:

        if not self.explorer_api_url:
            raise RuntimeError(
                f"{self.chain} explorer API is not configured"
            )

        request_params = dict(params)

        if self.explorer_api_key:
            request_params["apikey"] = (
                self.explorer_api_key
            )

        chain_id = self._chain_id()

        if chain_id is not None:
            request_params["chainid"] = chain_id

        response = request_with_retry(
            self.session,
            "GET",
            self.explorer_api_url,
            params=request_params,
            timeout=self.request_timeout,
            retry_config=self.retry_config,
        )

        response.raise_for_status()

        body = response.json()

        status = str(
            body.get("status", "1")
        )

        result = body.get(
            "result",
            [],
        )

        if status == "0" and result not in (
            "",
            [],
            "No transactions found",
            "0",
        ):
            raise RuntimeError(
                f"{self.chain} explorer error: "
                f"{body.get('message')}"
            )

        return result

    # =========================================================
    # BALANCE
    # =========================================================

    def get_balance(
        self,
        address: str,
    ) -> dict[str, Any]:

        balance_wei: int = 0

        if self.explorer_api_url and self.explorer_api_key:
            try:
                balance_wei = self._get_balance_from_explorer(address)
            except Exception:
                balance_wei = 0

        if balance_wei == 0:
            try:
                raw_balance = self._rpc("eth_getBalance", [address, "latest"])
                balance_wei = int(raw_balance, 16) if raw_balance else 0
            except Exception:
                pass

        return {
            "chain": self.chain,
            "address": address,
            "balance": (
                balance_wei / 10**18
            ),
            "asset": self._native_asset(),
        }

    def _get_balance_from_explorer(
        self,
        address: str,
    ) -> int:

        result = self._explorer_get(
            {
                "module": "account",
                "action": "balance",
                "address": address,
                "tag": "latest",
            }
        )

        try:
            if isinstance(result, (int, float)):
                return int(result)
            if isinstance(result, str) and result.strip():
                return int(result.strip())
        except (ValueError, TypeError):
            pass
        return 0

    # =========================================================
    # CONTRACT CODE
    # =========================================================

    def get_code(
        self,
        address: str,
    ) -> str:

        try:

            return self._rpc(
                "eth_getCode",
                [
                    address,
                    "latest",
                ],
            )

        except Exception:

            return "0x"

    # =========================================================
    # ALCHEMY
    # =========================================================

    def _get_transactions_from_alchemy(
        self,
        address: str,
        limit: int,
    ) -> list[NormalizedTransaction]:

        if not self.alchemy_api_key:
            return []

        alchemy_networks = {
            "ethereum": "eth-mainnet",
            "sepolia": "eth-sepolia",
            "polygon": "polygon-mainnet",
            "arbitrum": "arb-mainnet",
            "optimism": "opt-mainnet",
            "base": "base-mainnet",
            "bsc": "bnb-mainnet",
            "avalanche": "avax-mainnet",
            "celo": "celo-mainnet",
            "gnosis": "gnosis-mainnet",
            "moonbeam": "moonbeam-mainnet",
            "fantom": "fantom-mainnet",
            "linea": "linea-mainnet",
            "scroll": "scroll-mainnet",
            "zksync": "zksync-mainnet",
            "blast": "blast-mainnet",
            "mantle": "mantle-mainnet",
        }

        network = alchemy_networks.get(
            self.chain
        )

        if not network:

            print(
                f"[Alchemy] {self.chain}: "
                "not supported by this Alchemy mapping"
            )

            return []

        url = (
            f"https://{network}.g.alchemy.com/v2/"
            f"{self.alchemy_api_key}"
        )

        target_address = address.lower()

        # -----------------------------------------------------
        # FETCH TRANSFERS
        # -----------------------------------------------------

        def fetch_transfers(
            direction: str,
        ) -> list[dict[str, Any]]:

            transfers: list[
                dict[str, Any]
            ] = []

            page_key: str | None = None

            while len(transfers) < limit:

                remaining = (
                    limit - len(transfers)
                )

                categories = ["external", "erc20", "erc721", "erc1155"]
                if self.chain in ("ethereum", "polygon", "sepolia"):
                    categories.append("internal")

                params: dict[str, Any] = {
                    "fromBlock": "0x0",
                    "toBlock": "latest",
                    direction: address,

                    "category": categories,

                    "withMetadata": True,
                    
                    "excludeZeroValue": False,

                    "maxCount": hex(
                        min(
                            remaining,
                            1000,
                        )
                    ),
                }

                if page_key:
                    params["pageKey"] = page_key

                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": (
                        "alchemy_getAssetTransfers"
                    ),
                    "params": [params],
                }

                response = request_with_retry(
                    self.session,
                    "POST",
                    url,
                    json=payload,
                    timeout=self.request_timeout,
                    retry_config=self.retry_config,
                )

                response.raise_for_status()

                body = response.json()

                if body.get("error"):

                    raise RuntimeError(
                        f"Alchemy error: "
                        f"{body['error']}"
                    )

                result = (
                    body.get("result")
                    or {}
                )

                batch = (
                    result.get("transfers")
                    or []
                )

                transfers.extend(
                    batch
                )

                page_key = result.get(
                    "pageKey"
                )

                if (
                    not page_key
                    or not batch
                ):
                    break

            return transfers

        # -----------------------------------------------------
        # OUTGOING
        # -----------------------------------------------------

        outgoing = fetch_transfers(
            "fromAddress"
        )

        # -----------------------------------------------------
        # INCOMING
        # -----------------------------------------------------

        incoming = fetch_transfers(
            "toAddress"
        )

        transfers = (
            outgoing + incoming
        )

        # -----------------------------------------------------
        # REMOVE DUPLICATES
        # -----------------------------------------------------

        unique_transfers: dict[
            str,
            dict[str, Any],
        ] = {}

        for transfer in transfers:

            unique_id = transfer.get(
                "uniqueId"
            )

            tx_hash = transfer.get(
                "hash"
            )

            category = transfer.get(
                "category"
            )

            asset = transfer.get(
                "asset"
            )

            key = (
                unique_id
                or (f"{tx_hash}:{category}:{asset}" if tx_hash else None)
            )

            if key:
                unique_transfers[key] = (
                    transfer
                )

        # -----------------------------------------------------
        # NORMALIZE
        # -----------------------------------------------------

        results: list[
            NormalizedTransaction
        ] = []

        for transfer in (
            unique_transfers.values()
        ):

            tx_hash = (
                transfer.get("hash")
                or ""
            )

            if not tx_hash:
                continue

            from_address_raw = (
                transfer.get("from")
                or ""
            )

            to_address_raw = (
                transfer.get("to")
                or ""
            )

            from_address_lower = (
                from_address_raw.lower()
            )

            to_address_lower = (
                to_address_raw.lower()
            )

            category = (
                transfer.get("category")
                or ""
            ).lower()

            asset = (
                transfer.get("asset")
                or ""
            )

            # -------------------------------------------------
            # DIRECTION
            # -------------------------------------------------

            if (
                from_address_lower
                == target_address
            ):

                direction = "out"

            elif (
                to_address_lower
                == target_address
            ):

                direction = "in"

            else:

                direction = "unknown"

            # -------------------------------------------------
            # VALUE
            # -------------------------------------------------

            raw_value = transfer.get("value")

            try:
             if raw_value is not None:
              value = float(raw_value)
             else:
              raw_contract = transfer.get("rawContract") or {}
              raw_native_value = raw_contract.get("value")

              if raw_native_value:
                if isinstance(raw_native_value, str):
                  value = int(raw_native_value, 16) / 10**18
                else:
                  value = float(raw_native_value) / 10**18
              else:
               value = 0.0

            except (TypeError, ValueError):
              value = 0.0

            raw_contract = (
                transfer.get(
                    "rawContract"
                )
                or {}
            )

            token_contract = (
                raw_contract.get(
                    "address"
                )
            )

            # -------------------------------------------------
            # ASSET / TRANSACTION TYPE
            # -------------------------------------------------

            if category == "external":

                tx_type = "transfer"

                normalized_asset = (
                    asset
                    or self._native_asset()
                )

            elif category == "internal":

                tx_type = (
                    "internal_transfer"
                )

                normalized_asset = (
                    asset
                    or self._native_asset()
                )

            elif category == "erc20":

                tx_type = (
                    "token_transfer"
                )

                normalized_asset = (
                    asset
                    or "ERC20"
                )

            elif category in (
                "erc721",
                "erc1155",
            ):

                tx_type = "nft_transfer"

                normalized_asset = (
                    asset
                    or "NFT"
                )

            else:

                tx_type = "transfer"

                normalized_asset = (
                    asset
                    or self._native_asset()
                )

            # -------------------------------------------------
            # TIMESTAMP
            # -------------------------------------------------

            timestamp = datetime.now(
                tz=timezone.utc
            )

            metadata = (
                transfer.get(
                    "metadata"
                )
                or {}
            )

            block_timestamp = (
                metadata.get(
                    "blockTimestamp"
                )
            )

            if block_timestamp:

                try:

                    timestamp = (
                        datetime.fromisoformat(
                            block_timestamp.replace(
                                "Z",
                                "+00:00",
                            )
                        )
                    )

                except (
                    ValueError,
                    TypeError,
                ):

                    pass

            # -------------------------------------------------
            # BLOCK NUMBER
            # -------------------------------------------------

            block_number = None

            block_num = (
                transfer.get(
                    "blockNum"
                )
            )

            if block_num:

                try:

                    if isinstance(
                        block_num,
                        str,
                    ):

                        if block_num.startswith(
                            "0x"
                        ):

                            block_number = int(
                                block_num,
                                16,
                            )

                        else:

                            block_number = int(
                                block_num
                            )

                    else:

                        block_number = int(
                            block_num
                        )

                except (
                    ValueError,
                    TypeError,
                ):

                    block_number = None

            # -------------------------------------------------
            # TOKEN SYMBOL
            # -------------------------------------------------

            token_symbol = None

            if category == "erc20":
                token_symbol = (
                    asset or None
                )

            # -------------------------------------------------
            # DEBUG
            # -------------------------------------------------

            print(
                "[DEBUG][Alchemy]",
                f"hash={tx_hash}",
                f"category={category}",
                f"direction={direction}",
                f"asset={normalized_asset}",
                f"value={value}",
                f"from={from_address_raw}",
                f"to={to_address_raw}",
                f"block={block_number}",
            )

            # -------------------------------------------------
            # CREATE NORMALIZED TRANSACTION
            # -------------------------------------------------

            results.append(
                NormalizedTransaction(
                    chain=self.chain,

                    tx_hash=tx_hash,

                    block_number=(
                        block_number
                    ),

                    timestamp=timestamp,

                    from_address=(
                        from_address_raw
                    ),

                    to_address=(
                        to_address_raw
                        or None
                    ),

                    value=value,

                    asset=(
                        normalized_asset
                    ),

                    direction=direction,

                    tx_type=tx_type,

                    method_id=None,

                    token_contract=(
                        token_contract
                    ),

                    token_symbol=(
                        token_symbol
                    ),

                    raw=transfer,
                )
            )

        # -----------------------------------------------------
        # SORT
        # -----------------------------------------------------

        results.sort(
            key=lambda tx: tx.timestamp,
            reverse=True,
        )

        print(
            f"[Alchemy] {self.chain}: "
            f"converted "
            f"{len(results)} transfers"
        )

        incoming_total = sum(
            tx.value
            for tx in results
            if (
                tx.direction == "in"
                and tx.asset
                == self._native_asset()
            )
        )

        outgoing_total = sum(
            tx.value
            for tx in results
            if (
                tx.direction == "out"
                and tx.asset
                == self._native_asset()
            )
        )

        print(
            f"[Alchemy] {self.chain}: "
            f"incoming_native="
            f"{incoming_total} "
            f"outgoing_native="
            f"{outgoing_total}"
        )

        return results[:limit]

    # =========================================================
    # TRANSACTION ROUTER
    # =========================================================

    def get_transactions(
        self,
        address: str,
        limit: int = 100,
    ) -> list[NormalizedTransaction]:
        limit = min(max(1, limit), 100)

        # -----------------------------------------------------
        # 1. EXPLORER (Fast Etherscan API)
        # -----------------------------------------------------

        if self.explorer_api_url and self.explorer_api_key:
            try:
                transactions = (
                    self._get_transactions_from_explorer(
                        address,
                        limit,
                    )
                )

                print(
                    f"[Explorer] {self.chain}: "
                    f"returned "
                    f"{len(transactions)} "
                    f"transactions"
                )

                if transactions:
                    return transactions

            except Exception as e:

                print(
                    f"[Explorer] {self.chain} "
                    f"transaction error: "
                    f"{type(e).__name__}: {e}"
                )

        # -----------------------------------------------------
        # 2. ALCHEMY
        # -----------------------------------------------------

        supported_alchemy_chains = {"ethereum", "polygon", "arbitrum", "optimism", "base", "celo"}
        if self.alchemy_api_key and self.chain in supported_alchemy_chains:
            print(
                f"[DEBUG] Trying Alchemy for "
                f"{self.chain}, "
                f"key_exists="
                f"{bool(self.alchemy_api_key)}"
            )

            try:

                transactions = (
                    self._get_transactions_from_alchemy(
                        address,
                        limit,
                    )
                )

                print(
                    f"[Alchemy] {self.chain}: "
                    f"returned "
                    f"{len(transactions)} "
                    f"transactions"
                )

                if transactions:
                    return transactions

            except Exception as e:

                print(
                    f"[Alchemy] {self.chain} "
                    f"transaction error: "
                    f"{type(e).__name__}: {e}"
                )

        # Explorer without key fallback
        if self.explorer_api_url and not self.explorer_api_key:
            try:
                transactions = self._get_transactions_from_explorer(address, limit)
                if transactions:
                    return transactions
            except Exception:
                pass

        # -----------------------------------------------------
        # 3. BLOCKSCOUT
        # -----------------------------------------------------

        if self.blockscout_api_url:

            try:

                transactions = (
                    self._get_transactions_from_blockscout(
                        address,
                        limit,
                    )
                )

                print(
                    f"[Blockscout] {self.chain}: "
                    f"returned "
                    f"{len(transactions)} "
                    f"transactions"
                )

                if transactions:
                    return transactions

            except Exception as e:

                print(
                    f"[Blockscout] {self.chain} "
                    f"transaction error: "
                    f"{type(e).__name__}: {e}"
                )

        # -----------------------------------------------------
        # 4. RPC FALLBACK
        # -----------------------------------------------------

        try:

            latest_block = int(
                self._rpc(
                    "eth_blockNumber",
                    [],
                ),
                16,
            )

        except Exception as e:

            print(
                f"[RPC] {self.chain} "
                f"block-number error: "
                f"{type(e).__name__}: {e}"
            )

            return []

        results: list[
            NormalizedTransaction
        ] = []

        cursor = latest_block

        scan_blocks = min(
            self.max_rpc_scan_blocks,
            5,
        )

        min_block = max(
            0,
            latest_block - scan_blocks,
        )

        lower_address = (
            address.lower()
        )

        while (
            cursor >= min_block
            and len(results) < limit
        ):

            try:

                block = self._rpc(
                    "eth_getBlockByNumber",
                    [
                        hex(cursor),
                        True,
                    ],
                )

            except Exception as e:

                print(
                    f"[RPC] {self.chain} "
                    f"block {cursor} error: "
                    f"{type(e).__name__}: {e}"
                )

                break

            if not block:

                cursor -= 1
                continue

            block_timestamp = (
                datetime.fromtimestamp(
                    int(
                        block["timestamp"],
                        16,
                    ),
                    tz=timezone.utc,
                )
            )

            for tx in block.get(
                "transactions",
                [],
            ):

                from_address = (
                    tx.get("from")
                    or ""
                ).lower()

                to_address = (
                    tx.get("to")
                    or ""
                ).lower() or None

                if lower_address not in {
                    from_address,
                    to_address,
                }:
                    continue

                value = (
                    int(
                        tx.get(
                            "value",
                            "0x0",
                        ),
                        16,
                    )
                    / 10**18
                )

                direction = (
                    "out"
                    if (
                        from_address
                        == lower_address
                    )
                    else "in"
                )

                results.append(
                    NormalizedTransaction(
                        chain=self.chain,

                        tx_hash=tx["hash"],

                        block_number=(
                            int(
                                tx["blockNumber"],
                                16,
                            )
                            if tx.get(
                                "blockNumber"
                            )
                            else None
                        ),

                        timestamp=(
                            block_timestamp
                        ),

                        from_address=(
                            tx.get(
                                "from",
                                "",
                            )
                        ),

                        to_address=(
                            tx.get("to")
                        ),

                        value=value,

                        asset=(
                            self._native_asset()
                        ),

                        direction=direction,

                        tx_type="transfer",

                        method_id=(
                            tx.get("input")
                            or ""
                        )[:10]
                        or None,

                        token_contract=None,

                        token_symbol=None,

                        raw=tx,
                    )
                )

                if len(results) >= limit:
                    break

            cursor -= 1

        print(
            f"[RPC] {self.chain}: "
            f"found "
            f"{len(results)} transactions"
        )

        return results

    # =========================================================
    # BLOCKSCOUT
    # =========================================================

    def _get_transactions_from_blockscout(
        self,
        address: str,
        limit: int,
    ) -> list[NormalizedTransaction]:

        raw_txs = []
        try:
            resp_tx = request_with_retry(
                self.session,
                "GET",
                f"{self.blockscout_api_url}/addresses/{address}/transactions",
                params={"items_count": limit},
                timeout=self.request_timeout,
                retry_config=self.retry_config,
            )
            resp_tx.raise_for_status()
            tx_items = resp_tx.json().get("items") or []
            raw_txs.extend(tx_items)
        except Exception:
            pass

        try:
            resp_token = request_with_retry(
                self.session,
                "GET",
                f"{self.blockscout_api_url}/addresses/{address}/token-transfers",
                params={"items_count": limit},
                timeout=self.request_timeout,
                retry_config=self.retry_config,
            )
            resp_token.raise_for_status()
            token_items = resp_token.json().get("items") or []
            for item in token_items:
                item["_is_token_tx"] = True
            raw_txs.extend(token_items)
        except Exception:
            pass

        if not raw_txs:
            return []

        lower_address = address.lower()
        results: list[NormalizedTransaction] = []
        seen_keys: set[str] = set()

        for tx in raw_txs:
            tx_hash = tx.get("tx_hash") or tx.get("hash") or ""
            if not tx_hash:
                continue

            is_token = tx.get("_is_token_tx", False)
            unique_key = f"{tx_hash}:token:{tx.get('token', {}).get('address')}" if is_token else f"{tx_hash}:tx"
            if unique_key in seen_keys:
                continue
            seen_keys.add(unique_key)

            block_number = tx.get("block")
            timestamp_value = tx.get("timestamp")
            if isinstance(timestamp_value, str) and timestamp_value.endswith("Z"):
                try:
                    timestamp = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
                except ValueError:
                    timestamp = datetime.now(tz=timezone.utc)
            else:
                timestamp = datetime.now(tz=timezone.utc)

            from_data = tx.get("from")
            from_address_raw = from_data.get("hash", "") if isinstance(from_data, dict) else (from_data or "")
            from_address = from_address_raw.lower()

            to_data = tx.get("to")
            to_address_raw = to_data.get("hash") if isinstance(to_data, dict) else to_data

            if from_address == lower_address:
                direction = "out"
            elif to_address_raw and to_address_raw.lower() == lower_address:
                direction = "in"
            else:
                direction = "unknown"

            raw_val = tx.get("value") or "0"
            token_info = tx.get("token") or {}
            if is_token and token_info:
                try:
                    decimals = int(token_info.get("decimals") or 18)
                    value = float(raw_val) / (10**decimals)
                except (TypeError, ValueError):
                    value = 0.0
                asset_name = token_info.get("symbol") or "TOKEN"
                tx_type_str = "token_transfer"
                token_contract_str = token_info.get("address")
                token_symbol_str = asset_name
            else:
                try:
                    value = float(raw_val) / 10**18
                except (TypeError, ValueError):
                    value = 0.0
                asset_name = self._native_asset()
                tx_type_str = "transfer"
                token_contract_str = None
                token_symbol_str = None

            results.append(
                NormalizedTransaction(
                    chain=self.chain,
                    tx_hash=tx_hash,
                    block_number=int(block_number) if block_number else None,
                    timestamp=timestamp,
                    from_address=from_address_raw,
                    to_address=to_address_raw,
                    value=value,
                    asset=asset_name,
                    direction=direction,
                    tx_type=tx_type_str,
                    method_id=(tx.get("raw_input") or tx.get("method") or "")[:10] or None,
                    token_contract=token_contract_str,
                    token_symbol=token_symbol_str,
                    raw=tx,
                )
            )

        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]

    # =========================================================
    # EXPLORER TRANSACTIONS
    # =========================================================

    def _explorer_get(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        if not self.explorer_api_url:
            return []
        query_params = dict(params)
        if self.explorer_api_key:
            query_params["apikey"] = self.explorer_api_key
        chain_id = self._chain_id()
        if chain_id and "etherscan.io" in self.explorer_api_url:
            query_params["chainid"] = chain_id
        try:
            resp = request_with_retry(
                self.session,
                "GET",
                self.explorer_api_url,
                params=query_params,
                timeout=self.request_timeout,
                retry_config=self.retry_config,
            )
            data = resp.json()
            if isinstance(data, dict):
                res = data.get("result")
                if res is not None:
                    return res
            elif isinstance(data, list):
                return data
        except Exception as e:
            print(f"[Explorer Error] {self.chain}: {e}")
        return []

    def _get_transactions_from_explorer(
        self,
        address: str,
        limit: int,
    ) -> list[NormalizedTransaction]:

        raw_txs = []
        try:
            normal_txs = self._explorer_get(
                {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "startblock": 0,
                    "endblock": 99999999,
                    "page": 1,
                    "offset": limit,
                    "sort": "desc",
                }
            )
            if isinstance(normal_txs, list):
                raw_txs.extend(normal_txs)
        except Exception:
            pass

        try:
            token_txs = self._explorer_get(
                {
                    "module": "account",
                    "action": "tokentx",
                    "address": address,
                    "startblock": 0,
                    "endblock": 99999999,
                    "page": 1,
                    "offset": limit,
                    "sort": "desc",
                }
            )
            if isinstance(token_txs, list):
                for ttx in token_txs:
                    ttx["_is_token_tx"] = True
                raw_txs.extend(token_txs)
        except Exception:
            pass

        if not raw_txs:
            return []

        lower_address = address.lower()
        results: list[NormalizedTransaction] = []
        seen_keys: set[str] = set()

        for tx in raw_txs:
            tx_hash = tx.get("hash") or ""
            if not tx_hash:
                continue

            is_token = tx.get("_is_token_tx", False)
            unique_key = f"{tx_hash}:token:{tx.get('contractAddress')}" if is_token else f"{tx_hash}:tx"

            if unique_key in seen_keys:
                continue
            seen_keys.add(unique_key)

            try:
                timestamp = datetime.fromtimestamp(
                    int(tx.get("timeStamp", 0)),
                    tz=timezone.utc,
                )
            except (KeyError, TypeError, ValueError):
                timestamp = datetime.now(tz=timezone.utc)

            from_address_raw = tx.get("from") or ""
            from_address = from_address_raw.lower()
            to_address_raw = tx.get("to") or None

            if from_address == lower_address:
                direction = "out"
            elif to_address_raw and to_address_raw.lower() == lower_address:
                direction = "in"
            else:
                direction = "unknown"

            raw_val = tx.get("value", "0")
            if is_token:
                try:
                    decimals = int(tx.get("tokenDecimal") or 18)
                    value = int(raw_val) / (10**decimals)
                except (TypeError, ValueError):
                    value = 0.0
                asset_name = tx.get("tokenSymbol") or "TOKEN"
                tx_type_str = "token_transfer"
                token_contract_str = tx.get("contractAddress")
                token_symbol_str = asset_name
            else:
                try:
                    value = int(raw_val) / 10**18
                except (TypeError, ValueError):
                    value = 0.0
                asset_name = self._native_asset()
                tx_type_str = "transfer"
                token_contract_str = None
                token_symbol_str = None

            results.append(
                NormalizedTransaction(
                    chain=self.chain,
                    tx_hash=tx_hash,
                    block_number=int(tx["blockNumber"]) if tx.get("blockNumber") else None,
                    timestamp=timestamp,
                    from_address=from_address_raw,
                    to_address=to_address_raw,
                    value=value,
                    asset=asset_name,
                    direction=direction,
                    tx_type=tx_type_str,
                    method_id=(tx.get("input") or tx.get("method") or "")[:10] or None,
                    token_contract=token_contract_str,
                    token_symbol=token_symbol_str,
                    raw=tx,
                )
            )
        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]

    def _get_transactions_from_blockscout(
        self,
        address: str,
        limit: int,
    ) -> list[NormalizedTransaction]:
        if not self.blockscout_api_url:
            return []
        try:
            url = f"{self.blockscout_api_url.rstrip('/')}/addresses/{address}/transactions"
            res = requests.get(url, timeout=self.request_timeout)
            if res.status_code != 200:
                return []
            data = res.json()
            items = data.get("items", [])
            results: list[NormalizedTransaction] = []
            lower_address = address.lower()
            for tx in items[:limit]:
                tx_hash = tx.get("hash") or ""
                if not tx_hash:
                    continue
                from_addr = (tx.get("from") or {}).get("hash", "").lower()
                to_addr = (tx.get("to") or {}).get("hash", "").lower()
                raw_val = tx.get("value")
                if isinstance(raw_val, dict):
                    raw_val = raw_val.get("value") or "0"
                if raw_val is None:
                    raw_val = "0"
                try:
                    if isinstance(raw_val, str) and raw_val.startswith("0x"):
                        val = int(raw_val, 16) / 10**18
                    else:
                        val = int(str(raw_val)) / 10**18
                except (TypeError, ValueError):
                    val = 0.0

                if from_addr == lower_address:
                    direction = "out"
                elif to_addr == lower_address:
                    direction = "in"
                else:
                    direction = "unknown"

                raw_time = tx.get("timestamp")
                if raw_time:
                    try:
                        timestamp = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                    except Exception:
                        timestamp = datetime.now(tz=timezone.utc)
                else:
                    timestamp = datetime.now(tz=timezone.utc)

                results.append(
                    NormalizedTransaction(
                        tx_hash=tx_hash,
                        chain=self.chain,
                        block_number=tx.get("block"),
                        timestamp=timestamp,
                        from_address=from_addr,
                        to_address=to_addr,
                        value=val,
                        asset=self._native_asset(),
                        direction=direction,
                        tx_type="transfer",
                    )
                )
            return results
        except Exception as e:
            print(f"[Blockscout Error] {self.chain}: {e}")
            return []

    # =========================================================
    # TOKEN TRANSFERS
    # =========================================================

    def get_token_transfers(
        self,
        address: str,
        from_block: str = "0x0",
        to_block: str = "latest",
    ) -> list[dict[str, Any]]:

        if (
            self.explorer_api_url
            and self.explorer_api_key
        ):

            try:

                return self._explorer_get(
                    {
                        "module": "account",
                        "action": "tokentx",
                        "address": address,

                        "startblock": (
                            int(
                                from_block,
                                16,
                            )
                            if from_block.startswith(
                                "0x"
                            )
                            else 0
                        ),

                        "endblock": (
                            99999999
                            if to_block
                            == "latest"
                            else (
                                int(
                                    to_block,
                                    16,
                                )
                                if to_block.startswith(
                                    "0x"
                                )
                                else int(
                                    to_block
                                )
                            )
                        ),

                        "page": 1,
                        "offset": 100,
                        "sort": "desc",
                    }
                )

            except Exception:

                pass

        padded_address = (
            "0x"
            + address.lower()
            .replace(
                "0x",
                "",
            )
            .rjust(
                64,
                "0",
            )
        )

        return self._rpc(
            "eth_getLogs",
            [
                {
                    "fromBlock": from_block,
                    "toBlock": to_block,
                    "topics": [
                        TRANSFER_EVENT_TOPIC,
                        None,
                        padded_address,
                    ],
                }
            ],
        )

    # =========================================================
    # NATIVE ASSET
    # =========================================================

    def _native_asset(
        self,
    ) -> str:

        return {
            "ethereum": "ETH",
            "sepolia": "ETH",
            "bsc": "BNB",
            "polygon": "MATIC",
            "arbitrum": "ETH",
            "optimism": "ETH",
            "base": "ETH",
            "avalanche": "AVAX",
            "celo": "CELO",
            "gnosis": "xDAI",
            "moonbeam": "GLMR",
            "metis": "METIS",
            "fantom": "FTM",
            "cronos": "CRO",
            "kava": "KAVA",
            "linea": "ETH",
            "scroll": "ETH",
            "zksync": "ETH",
            "blast": "ETH",
            "mantle": "MNT",
            "ronin": "RON",
            "core": "CORE",
            "flare": "FLR",
            "moonriver": "MOVR",
            "evmos": "EVMOS",
        }.get(
            self.chain,
            "NATIVE",
        )

    # =========================================================
    # CHAIN ID
    # =========================================================

    def _chain_id(
        self,
    ) -> int | None:

        return {
            "ethereum": 1,
            "sepolia": 11155111,
            "bsc": 56,
            "polygon": 137,
            "arbitrum": 42161,
            "optimism": 10,
            "base": 8453,
            "avalanche": 43114,
            "celo": 42220,
            "gnosis": 100,
            "moonbeam": 1284,
            "metis": 1088,
            "fantom": 250,
            "cronos": 25,
            "kava": 2222,
            "linea": 59144,
            "scroll": 534352,
            "zksync": 324,
            "blast": 81457,
            "mantle": 5000,
            "ronin": 2020,
            "core": 1116,
            "flare": 14,
            "moonriver": 1285,
            "evmos": 9001,
        }.get(
            self.chain
        )