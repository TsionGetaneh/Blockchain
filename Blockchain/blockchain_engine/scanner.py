from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime

from blockchain_engine.connectors.base import BaseConnector

from blockchain_engine.alerts import AlertEngine
from blockchain_engine.config import ScannerConfig
from blockchain_engine.connectors import BitcoinConnector, EVMConnector
from blockchain_engine.connectors.solana import SolanaConnector
from blockchain_engine.detectors import (
    classify_entity,
    detect_activity,
    label_transactions,
)
from blockchain_engine.explorer import ExplorerService
from blockchain_engine.graph_analysis import GraphAnalyzer
from blockchain_engine.indexer import SqliteIndexer
from blockchain_engine.models import (
    NormalizedTransaction,
    RiskResult,
    ScreeningMatch,
    ScreeningResult,
)
from blockchain_engine.network import RetryConfig
from blockchain_engine.public_feeds import PublicFeedSync
from blockchain_engine.risk_engine import RiskEngine
from blockchain_engine.watchlist import WatchlistManager


class BlockchainScanner:

    def __init__(
        self,
        config: ScannerConfig | None = None,
    ) -> None:

        self.config = config or ScannerConfig()

        self.config.ensure_data_dir()

        retry_config = RetryConfig(
            attempts=self.config.request_retries,
            backoff_seconds=self.config.request_backoff_seconds,
        )

        # =====================================================
        # CONNECTORS
        # =====================================================

        self.connectors = {

            # -------------------------------------------------
            # Ethereum
            # -------------------------------------------------

            "ethereum": EVMConnector(
                chain="ethereum",
                rpc_url=self.config.ethereum_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.ethereum_explorer_api_url,
                explorer_api_key=self.config.explorer_api_key,
                alchemy_api_key=self.config.alchemy_api_key,
                blockscout_api_url=self.config.ethereum_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # BSC
            # -------------------------------------------------

            "bsc": EVMConnector(
                chain="bsc",
                rpc_url=self.config.bsc_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.bsc_explorer_api_url,
                explorer_api_key=self.config.explorer_api_key,
                alchemy_api_key=self.config.alchemy_api_key,
                blockscout_api_url=self.config.bsc_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Polygon
            # -------------------------------------------------

            "polygon": EVMConnector(
                chain="polygon",
                rpc_url=self.config.polygon_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.polygon_explorer_api_url,
                explorer_api_key=self.config.explorer_api_key,
                alchemy_api_key=self.config.alchemy_api_key,
                blockscout_api_url=self.config.polygon_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Arbitrum
            # -------------------------------------------------

            "arbitrum": EVMConnector(
                chain="arbitrum",
                rpc_url=self.config.arbitrum_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.arbitrum_explorer_api_url,
                explorer_api_key=self.config.explorer_api_key,
                alchemy_api_key=self.config.alchemy_api_key,
                blockscout_api_url=self.config.arbitrum_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Bitcoin
            # -------------------------------------------------

            "bitcoin": BitcoinConnector(
                api_url=self.config.bitcoin_api_url,
                request_timeout=self.config.request_timeout,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Sepolia
            # -------------------------------------------------

            "sepolia": EVMConnector(
                chain="sepolia",
                rpc_url=self.config.sepolia_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.ethereum_explorer_api_url,
                explorer_api_key=self.config.explorer_api_key,
                blockscout_api_url=self.config.sepolia_blockscout_api_url,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Optimism
            # -------------------------------------------------

            "optimism": EVMConnector(
                chain="optimism",
                rpc_url=self.config.optimism_rpc_url,
                request_timeout=self.config.request_timeout,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Avalanche
            # -------------------------------------------------

            "avalanche": EVMConnector(
                chain="avalanche",
                rpc_url=self.config.avalanche_rpc_url,
                request_timeout=self.config.request_timeout,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Fantom
            # -------------------------------------------------

            "fantom": EVMConnector(
                chain="fantom",
                rpc_url=self.config.fantom_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.fantom_explorer_api_url,
                blockscout_api_url=self.config.fantom_blockscout_api_url,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Base
            # -------------------------------------------------

            "base": EVMConnector(
                chain="base",
                rpc_url=self.config.base_rpc_url,
                request_timeout=self.config.request_timeout,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Celo
            # -------------------------------------------------

            "celo": EVMConnector(
                chain="celo",
                rpc_url=self.config.celo_rpc_url,
                request_timeout=self.config.request_timeout,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Gnosis
            # -------------------------------------------------

            "gnosis": EVMConnector(
                chain="gnosis",
                rpc_url=self.config.gnosis_rpc_url,
                request_timeout=self.config.request_timeout,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Cronos
            # -------------------------------------------------

            "cronos": EVMConnector(
                chain="cronos",
                rpc_url=self.config.cronos_rpc_url,
                request_timeout=self.config.request_timeout,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Moonbeam
            # -------------------------------------------------

            "moonbeam": EVMConnector(
                chain="moonbeam",
                rpc_url=self.config.moonbeam_rpc_url,
                request_timeout=self.config.request_timeout,
                blockscout_api_url=self.config.moonbeam_blockscout_api_url,
                alchemy_api_key=self.config.alchemy_api_key,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Metis
            # -------------------------------------------------

            "metis": EVMConnector(
                chain="metis",
                rpc_url=self.config.metis_rpc_url,
                request_timeout=self.config.request_timeout,
                explorer_api_url=self.config.metis_explorer_api_url,
                blockscout_api_url=self.config.metis_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Kava
            # -------------------------------------------------

            "kava": EVMConnector(
                chain="kava",
                rpc_url=self.config.kava_rpc_url,
                request_timeout=self.config.request_timeout,
                blockscout_api_url=self.config.kava_blockscout_api_url,
                max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
                retry_config=retry_config,
            ),

            # -------------------------------------------------
            # Solana
            # -------------------------------------------------

            "solana": SolanaConnector(
                api_url=self.config.solana_api_url,
                request_timeout=self.config.request_timeout,
                retry_config=retry_config,
            ),
        }

        # =====================================================
        # SERVICES
        # =====================================================

        self.indexer = SqliteIndexer(
            self.config.data_dir
        )

        self.risk_engine = RiskEngine(
            self.config.data_dir
        )

        self.feed_sync = PublicFeedSync(
            self.config,
            self.config.request_timeout,
        )

        self.watchlist = WatchlistManager(
            self.config.data_dir
        )

        self.explorer = ExplorerService(
            self.indexer
        )

        self.graph_analyzer = GraphAnalyzer()

        self.alert_engine = AlertEngine(
            self.config.data_dir
        )

    def _get_connector(self, chain: str) -> BaseConnector:
        chain_lower = (chain or "ethereum").lower()
        if chain_lower in self.connectors:
            return self.connectors[chain_lower]

        # Dynamic fallback EVM connector for any unlisted EVM chain
        retry_config = RetryConfig(
            attempts=self.config.request_retries,
            backoff_seconds=self.config.request_backoff_seconds,
        )
        rpc_url = getattr(self.config, f"{chain_lower}_rpc_url", self.config.ethereum_rpc_url)
        connector = EVMConnector(
            chain=chain_lower,
            rpc_url=rpc_url,
            request_timeout=self.config.request_timeout,
            alchemy_api_key=self.config.alchemy_api_key,
            max_rpc_scan_blocks=self.config.max_rpc_scan_blocks,
            retry_config=retry_config,
        )
        self.connectors[chain_lower] = connector
        return connector

    # =========================================================
    # PUBLIC FEEDS
    # =========================================================

    def sync_public_feeds(
        self,
    ) -> dict[str, int]:

        return self.feed_sync.sync_all()

    # =========================================================
    # DATABASE ROWS -> NORMALIZED TRANSACTIONS
    # =========================================================

    def _dicts_to_transactions(
        self,
        rows: list[dict],
    ) -> list[NormalizedTransaction]:

        return [
            NormalizedTransaction(
                chain=row["chain"],
                tx_hash=row["tx_hash"],
                block_number=row["block_number"],
                timestamp=(
                    datetime.fromisoformat(
                        row["timestamp"]
                    )
                    if isinstance(
                        row["timestamp"],
                        str,
                    )
                    else row["timestamp"]
                ),
                from_address=row["from_address"],
                to_address=row["to_address"],
                value=float(row["value"]),
                asset=row["asset"],
                direction=row["direction"],
                method_id=row.get("method_id"),
                token_contract=row.get(
                    "token_contract"
                ),
                token_symbol=row.get(
                    "token_symbol"
                ),
                raw=row.get(
                    "raw",
                    {},
                ),
            )
            for row in rows
        ]

    # =========================================================
    # SCAN ADDRESS
    # =========================================================

    def scan_address(
        self,
        chain: str,
        address: str,
        limit: int = 50,
    ) -> RiskResult:

        connector = self._get_connector(chain)

        # -----------------------------------------------------
        # 1. Try local database first
        # -----------------------------------------------------

        stored_transactions = (
            self.explorer.get_address_transactions(
                chain,
                address,
                limit=limit,
            )
        )

        transactions = self._dicts_to_transactions(
            stored_transactions
        )

        print(
            "[DEBUG] Stored transactions:",
            len(transactions),
        )

        # -----------------------------------------------------
        # 2. Fetch from blockchain if database is empty
        # -----------------------------------------------------

        if not transactions:

            print(
                f"[DEBUG] Fetching transactions from "
                f"{chain} blockchain..."
            )

            transactions = connector.get_transactions(
                address=address,
                limit=limit,
            )

            print(
                "[DEBUG] Blockchain returned:",
                len(transactions),
                "transactions",
            )

            # Save newly fetched transactions
            if transactions:
                self.indexer.append(
                    transactions
                )

        # -----------------------------------------------------
        # 3. Label transactions
        # -----------------------------------------------------

        label_transactions(
            transactions,
            address,
        )

        # -----------------------------------------------------
        # 4. Detect suspicious activity
        # -----------------------------------------------------

        detections = detect_activity(
            transactions,
        )

        # -----------------------------------------------------
        # 5. Classify entity
        # -----------------------------------------------------

        bytecode = connector.get_code(
            address
        )

        entity_label = classify_entity(
            address=address,
            transactions=transactions,
            detections=detections,
            bytecode=bytecode,
        )

        # -----------------------------------------------------
        # 6. Screen address & Calculate risk
        # -----------------------------------------------------

        screening = self.screen_address(chain, address)

        result = self.risk_engine.evaluate(
            chain=chain,
            address=address,
            transactions=transactions,
            detections=detections,
            entity_label=entity_label,
            screening=screening,
        )

        return result

    # =========================================================
    # CROSS CHAIN SCAN
    # =========================================================

    def scan_cross_chain(
        self,
        addresses: dict[str, str],
        limit: int = 25,
    ) -> dict[str, RiskResult]:

        with ThreadPoolExecutor(
            max_workers=min(
                4,
                max(
                    1,
                    len(addresses),
                ),
            )
        ) as executor:

            futures = {
                chain: executor.submit(
                    self.scan_address,
                    chain=chain,
                    address=address,
                    limit=limit,
                )
                for chain, address in addresses.items()
            }

            results: dict[str, RiskResult] = {}
            errors: dict[str, str] = {}

            for chain, future in futures.items():

                try:
                    results[chain] = future.result()

                except Exception as exc:
                    errors[chain] = str(exc)

            if errors and not results:
                raise RuntimeError(
                    f"Cross-chain scan failed: {errors}"
                )

            return results

    # =========================================================
    # BALANCE
    # =========================================================

    def get_balance(
        self,
        chain: str,
        address: str,
    ) -> dict:

        print(
            f"[DEBUG][SCANNER BALANCE] "
            f"chain={chain} "
            f"address={address}"
        )

        connector = self._get_connector(chain)
        balance = connector.get_balance(address)

        print(
            f"[DEBUG][SCANNER BALANCE RESULT] "
            f"{balance}"
        )

        return balance


    # =========================================================
    # TOKEN TRANSFERS
    # =========================================================

    def get_token_transfers(
        self,
        chain: str,
        address: str,
        from_block: str = "0x0",
        to_block: str = "latest",
    ) -> list[dict]:

        connector = self._get_connector(chain)

        if not hasattr(
            connector,
            "get_token_transfers",
        ):
            raise ValueError(
                f"Token transfers are not supported "
                f"for chain '{chain}'"
            )

        return connector.get_token_transfers(
            address,
            from_block=from_block,
            to_block=to_block,
        )

    # =========================================================
    # CHAIN HEALTH
    # =========================================================

    def get_chain_health(
        self,
    ) -> dict[str, str]:

        status: dict[str, str] = {}

        with ThreadPoolExecutor(
            max_workers=min(
                8,
                len(self.connectors),
            )
        ) as executor:

            futures = {
                executor.submit(
                    self._check_chain_health,
                    chain,
                    connector,
                ): chain
                for chain, connector
                in self.connectors.items()
            }

            for future in futures:

                chain = futures[future]

                try:
                    status[chain] = future.result(
                        timeout=self.config.request_timeout + 2
                    )

                except TimeoutError:
                    status[chain] = "error: timeout"

                except Exception as exc:
                    status[chain] = (
                        f"error: {exc}"
                    )

        return status

    # =========================================================
    # CHECK CHAIN
    # =========================================================

    def _check_chain_health(
        self,
        chain: str,
        connector: object,
    ) -> str:

        try:

            if chain == "bitcoin":

                connector.get_balance(
                    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                )

            else:

                connector.get_balance(
                    "0x0000000000000000000000000000000000000000"
                )

            return "ok"

        except Exception as exc:
            return f"error: {exc}"

    # =========================================================
    # SCREEN ADDRESS
    # =========================================================

    def screen_address(
        self,
        chain: str,
        address: str,
    ) -> ScreeningResult:

        flagged_db = (
            self.risk_engine._load_flagged_db()
        )

        address_key = address.lower()

        matches = [
            ScreeningMatch(
                address=record["address"],
                category=record["category"],
                source=record["source"],
                score=int(
                    record.get(
                        "score",
                        60,
                    )
                ),
                label=record.get("label"),
            )
            for record in (
                flagged_db.get(chain, [])
                + flagged_db.get("global", [])
            )
            if record["address"].lower()
            == address_key
        ]

        # -----------------------------------------------------
        # Entity labeling
        # -----------------------------------------------------

        connector = self.connectors[chain]

        bytecode = connector.get_code(
            address
        )

        entity_label = classify_entity(
            address=address,
            transactions=[],
            detections=[],
            bytecode=bytecode,
        )

        return ScreeningResult(
            address=address,
            chain=chain,
            matched=bool(matches),
            entity_label=entity_label,
            matches=matches,
        )

    # =========================================================
    # EXPLORE ADDRESS
    # =========================================================

    def explore_address(
        self,
        chain: str,
        address: str,
        limit: int = 50,
    ) -> dict:

        print(
            f"[DEBUG][EXPLORE] Refreshing blockchain data "
            f"for {chain}:{address}"
        )

        connector = self._get_connector(chain)

        # -------------------------------------------------
        # 1. Fetch fresh transactions directly from blockchain
        # -------------------------------------------------

        fresh_transactions = []
        try:
            fresh_transactions = connector.get_transactions(
                address=address,
                limit=limit,
            )

            print(
                f"[DEBUG][EXPLORE] Fresh transactions fetched: "
                f"{len(fresh_transactions)}"
            )

            if fresh_transactions:
                self.indexer.append(fresh_transactions)

        except Exception as exc:
            print(
                f"[ERROR][EXPLORE] Could not refresh transactions: "
                f"{type(exc).__name__}: {exc}"
            )

        # -------------------------------------------------
        # 2. Get transactions for response
        # -------------------------------------------------

        if fresh_transactions:
            transactions = [
                tx.to_dict() if hasattr(tx, "to_dict") else tx
                for tx in fresh_transactions
            ]
        else:
            transactions = self.explorer.get_address_transactions(
                chain,
                address,
                limit=limit,
            )

        print(
            f"[DEBUG][EXPLORE] Returning transactions: {len(transactions)}"
        )

        # -------------------------------------------------
        # 3. Get CURRENT blockchain balance
        # -------------------------------------------------

        try:
            balance_info = self.get_balance(
                chain,
                address,
            )

            if isinstance(balance_info, dict):
                balance = float(balance_info.get("balance", 0.0))
            else:
                balance = float(balance_info or 0.0)

        except Exception as exc:
            print(
                f"[ERROR][BALANCE] "
                f"chain={chain} "
                f"address={address} "
                f"{type(exc).__name__}: {exc}"
            )
            balance = 0.0

        # Calculate totals
        incoming_total = sum(
            float(tx.get("value", 0))
            for tx in transactions
            if str(tx.get("direction", "")).lower() == "in"
        )
        outgoing_total = sum(
            float(tx.get("value", 0))
            for tx in transactions
            if str(tx.get("direction", "")).lower() == "out"
        )

        unit = connector._native_asset() if hasattr(connector, "_native_asset") else "ETH"

        return {
            "address": address,
            "chain": chain,
            "balance": balance,
            "transaction_count": len(transactions),
            "incoming_total": round(incoming_total, 4),
            "outgoing_total": round(outgoing_total, 4),
            "transactions": transactions,
            "unit": unit,
        }

    

    # =========================================================
    # EXPLORE TRANSACTION
    # =========================================================

    def explore_transaction(
        self,
        tx_hash: str,
    ) -> dict | None:

        return self.explorer.get_transaction(
            tx_hash
        )

    # =========================================================
    # BUILD GRAPH
    # =========================================================

    def build_graph(
        self,
        chain: str,
        address: str,
        limit: int = 25,
    ) -> dict:

        result = self.scan_address(
            chain=chain,
            address=address,
            limit=limit,
        )

        transactions = (
            self.explorer.get_address_transactions(
                chain,
                address,
                limit=limit,
            )
        )

        return self.graph_analyzer.build_graph(
            root_address=address,
            risk_score=result.score,
            label=result.label,
            entity_label=result.entity_label,
            transactions=transactions,
        )

    # =========================================================
    # CLUSTER ADDRESS
    # =========================================================

    def cluster_address(
        self,
        chain: str,
        address: str,
        limit: int = 25,
    ) -> list[dict]:

        self.scan_address(
            chain=chain,
            address=address,
            limit=limit,
        )

        transactions = (
            self.explorer.get_address_transactions(
                chain,
                address,
                limit=limit,
            )
        )

        return self.graph_analyzer.cluster_addresses(
            transactions
        )

    # =========================================================
    # EVALUATE ALERTS
    # =========================================================

    def evaluate_alerts(
        self,
        chain: str,
        address: str,
        limit: int = 25,
    ) -> list[dict]:

        result = self.scan_address(
            chain=chain,
            address=address,
            limit=limit,
        )

        watchlist_entries = [
            entry
            for entry in self.watchlist.list_entries()
            if (
                entry["chain"] == chain
                and entry["address"].lower()
                == address.lower()
            )
        ]

        transactions = (
            self.explorer.get_address_transactions(
                chain,
                address,
                limit=limit,
            )
        )

        clusters = (
            self.graph_analyzer.cluster_addresses(
                transactions
            )
        )

        return self.alert_engine.evaluate(
            address=address,
            chain=chain,
            risk_score=result.score,
            risk_label=result.label,
            watchlist_entries=watchlist_entries,
            clusters=clusters,
            transactions=transactions,
        )