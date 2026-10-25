from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from blockchain_engine.models import NormalizedTransaction


class SqliteIndexer:

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = self.data_dir / "blockchain_index.db"

        self._initialize()

    # =========================================================
    # DATABASE INITIALIZATION
    # =========================================================

    def _initialize(self) -> None:
        with sqlite3.connect(self.db_path) as connection:

            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=NORMAL")
            connection.execute("PRAGMA temp_store=MEMORY")

            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS normalized_transactions (
                    chain TEXT NOT NULL,
                    tx_hash TEXT NOT NULL,
                    block_number INTEGER,
                    timestamp TEXT NOT NULL,
                    from_address TEXT NOT NULL,
                    to_address TEXT,
                    value REAL NOT NULL,
                    asset TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    tx_type TEXT NOT NULL DEFAULT 'transfer',
                    method_id TEXT,
                    token_contract TEXT,
                    token_symbol TEXT,
                    raw_json TEXT NOT NULL,
                    PRIMARY KEY (chain, tx_hash)
                )
                """
            )

            # -------------------------------------------------
            # Migration: add tx_type if the old database
            # does not have it.
            # -------------------------------------------------

            try:
                connection.execute(
                    """
                    ALTER TABLE normalized_transactions
                    ADD COLUMN tx_type TEXT NOT NULL DEFAULT 'transfer'
                    """
                )

            except sqlite3.OperationalError:
                # Column already exists.
                pass

            # -------------------------------------------------
            # INDEXES
            # -------------------------------------------------

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_normalized_transactions_timestamp

                ON normalized_transactions (timestamp DESC)
                """
            )

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_normalized_transactions_address

                ON normalized_transactions (
                    chain,
                    from_address,
                    to_address
                )
                """
            )

    # =========================================================
    # VALUE RECOVERY
    # =========================================================

    @staticmethod
    def _recover_value(
        stored_value: Any,
        raw: dict[str, Any],
        asset: str,
    ) -> float:

        # -----------------------------------------------------
        # If the database already contains a real value,
        # keep it.
        # -----------------------------------------------------

        try:
            value = float(stored_value or 0)

        except (TypeError, ValueError):
            value = 0.0

        if value != 0.0:
            return value

        # -----------------------------------------------------
        # Try to recover value from the original transaction.
        # -----------------------------------------------------

        if not isinstance(raw, dict):
            return 0.0

        raw_value = raw.get("value")

        if raw_value is None:
            return 0.0

        try:
            recovered = float(raw_value)

        except (TypeError, ValueError):
            return 0.0

        return recovered

    # =========================================================
    # DIRECTION RECOVERY
    # =========================================================

    @staticmethod
    def _correct_direction(
        address: str,
        from_address: str,
        to_address: str | None,
    ) -> str:

        address_lower = (
            address or ""
        ).lower()

        from_lower = (
            from_address or ""
        ).lower()

        to_lower = (
            to_address or ""
        ).lower()

        # -----------------------------------------------------
        # Wallet is the sender.
        # -----------------------------------------------------

        if from_lower == address_lower:
            return "out"

        # -----------------------------------------------------
        # Wallet is the receiver.
        # -----------------------------------------------------

        if to_lower == address_lower:
            return "in"

        # -----------------------------------------------------
        # Fallback.
        # -----------------------------------------------------

        return "in"

    # =========================================================
    # APPEND TRANSACTIONS
    # =========================================================

    def append(
        self,
        transactions: list[NormalizedTransaction],
    ) -> None:

        if not transactions:
            return

        # Sort transactions so non-zero values and token transfers take priority when inserting
        sorted_txs = sorted(
            transactions,
            key=lambda tx: (
                1 if (tx.value or 0) > 0 else 0,
                1 if tx.tx_type in ("token_transfer", "internal_transfer", "nft_transfer") else 0,
            ),
        )

        with sqlite3.connect(self.db_path) as connection:

            connection.execute(
                "PRAGMA synchronous=NORMAL"
            )

            # Query existing non-zero transactions to avoid overwriting them with 0.0 values
            cursor = connection.cursor()
            existing_nonzero = set()
            cursor.execute("SELECT chain, tx_hash FROM normalized_transactions WHERE value > 0")
            for row in cursor.fetchall():
                existing_nonzero.add((row[0], row[1]))

            rows_to_insert = []
            for tx in sorted_txs:
                # Skip 0-value external wrappers if a non-zero version already exists in DB
                if (tx.value or 0) == 0 and (tx.chain, tx.tx_hash) in existing_nonzero:
                    continue

                rows_to_insert.append((
                    tx.chain,
                    tx.tx_hash,
                    tx.block_number,
                    tx.timestamp.isoformat(),
                    tx.from_address,
                    tx.to_address,
                    tx.value,
                    tx.asset,
                    tx.direction,
                    tx.tx_type,
                    tx.method_id,
                    tx.token_contract,
                    tx.token_symbol,
                    json.dumps(
                        tx.raw,
                        default=str,
                    ),
                ))

            if rows_to_insert:
                connection.executemany(
                    """
                    INSERT OR REPLACE INTO normalized_transactions (

                        chain,
                        tx_hash,
                        block_number,
                        timestamp,
                        from_address,
                        to_address,
                        value,
                        asset,
                        direction,
                        tx_type,
                        method_id,
                        token_contract,
                        token_symbol,
                        raw_json

                    )

                    VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    """,
                    rows_to_insert,
                )

    # =========================================================
    # READ ALL
    # =========================================================

    def read_all(
        self,
        limit: int | None = None,
    ) -> list[dict]:

        with sqlite3.connect(self.db_path) as connection:

            query = """
                SELECT
                    chain,
                    tx_hash,
                    block_number,
                    timestamp,
                    from_address,
                    to_address,
                    value,
                    asset,
                    direction,
                    method_id,
                    token_contract,
                    token_symbol,
                    raw_json
                FROM normalized_transactions
                ORDER BY timestamp DESC
            """

            params: tuple[int, ...] = ()

            if limit is not None:
                query += " LIMIT ?"
                params = (limit,)

            cursor = connection.execute(
                query,
                params,
            )

            rows = cursor.fetchall()

        results: list[dict] = []

        for row in rows:

            raw = self._load_raw(row[12])

            value = self._recover_value(
                row[6],
                raw,
                row[7],
            )

            results.append(
                {
                    "chain": row[0],
                    "tx_hash": row[1],
                    "block_number": row[2],
                    "timestamp": row[3],
                    "from_address": row[4],
                    "to_address": row[5],
                    "value": value,
                    "asset": row[7],
                    "direction": row[8],
                    "method_id": row[9],
                    "token_contract": row[10],
                    "token_symbol": row[11],
                    "raw": raw,
                }
            )

        return results

    # =========================================================
    # ADDRESS STATS
    # =========================================================

    def get_address_stats(
        self,
        chain: str,
        address: str,
    ) -> dict[str, Any]:

        transactions = self.read_by_address(
            chain,
            address,
            limit=10000,
        )

        incoming_total = 0.0
        outgoing_total = 0.0

        for tx in transactions:

            value = float(
                tx.get("value") or 0.0
            )

            direction = (
                tx.get("direction")
                or ""
            ).lower()

            if direction == "in":
                incoming_total += value

            elif direction == "out":
                outgoing_total += value

        return {
            "incoming_total": round(incoming_total, 4),
            "outgoing_total": round(outgoing_total, 4),
            "transaction_count": len(transactions),
        }

    # =========================================================
    # READ BY TRANSACTION HASH
    # =========================================================

    def read_by_tx_hash(
        self,
        tx_hash: str,
    ) -> dict | None:

        with sqlite3.connect(self.db_path) as connection:

            cursor = connection.execute(
                """
                SELECT
                    chain,
                    tx_hash,
                    block_number,
                    timestamp,
                    from_address,
                    to_address,
                    value,
                    asset,
                    direction,
                    method_id,
                    token_contract,
                    token_symbol,
                    raw_json
                FROM normalized_transactions
                WHERE tx_hash = ?
                LIMIT 1
                """,
                (tx_hash,),
            )

            row = cursor.fetchone()

        if row is None:
            return None

        raw = self._load_raw(row[12])

        value = self._recover_value(
            row[6],
            raw,
            row[7],
        )

        return {
            "chain": row[0],
            "tx_hash": row[1],
            "block_number": row[2],
            "timestamp": row[3],
            "from_address": row[4],
            "to_address": row[5],
            "value": value,
            "asset": row[7],
            "direction": row[8],
            "method_id": row[9],
            "token_contract": row[10],
            "token_symbol": row[11],
            "raw": raw,
        }

    # =========================================================
    # READ BY ADDRESS
    # =========================================================

    def read_by_address(
        self,
        chain: str,
        address: str,
        limit: int = 25,
    ) -> list[dict]:

        lower_address = address.lower()

        with sqlite3.connect(self.db_path) as connection:

            cursor = connection.execute(
                """
                SELECT
                    chain,
                    tx_hash,
                    block_number,
                    timestamp,
                    from_address,
                    to_address,
                    value,
                    asset,
                    direction,
                    method_id,
                    token_contract,
                    token_symbol,
                    raw_json
                FROM normalized_transactions
                WHERE LOWER(chain) = LOWER(?)
                  AND (
                      LOWER(from_address) = ?
                      OR LOWER(
                          COALESCE(to_address, '')
                      ) = ?
                  )
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (
                    chain,
                    lower_address,
                    lower_address,
                    limit,
                ),
            )

            rows = cursor.fetchall()

        results: list[dict] = []

        for row in rows:

            raw = self._load_raw(row[12])

            # -------------------------------------------------
            # Recover value.
            # -------------------------------------------------

            value = self._recover_value(
                row[6],
                raw,
                row[7],
            )

            # -------------------------------------------------
            # Correct direction.
            # -------------------------------------------------

            direction = self._correct_direction(
                address=address,
                from_address=row[4],
                to_address=row[5],
            )

            results.append(
                {
                    "chain": row[0],
                    "tx_hash": row[1],
                    "block_number": row[2],
                    "timestamp": row[3],
                    "from_address": row[4],
                    "to_address": row[5],
                    "value": value,
                    "asset": row[7],
                    "direction": direction,
                    "method_id": row[9],
                    "token_contract": row[10],
                    "token_symbol": row[11],
                    "raw": raw,
                }
            )

        return results

    # =========================================================
    # LOAD RAW JSON SAFELY
    # =========================================================

    @staticmethod
    def _load_raw(
        raw_json: str | None,
    ) -> dict[str, Any]:

        if not raw_json:
            return {}

        try:
            value = json.loads(raw_json)

            if isinstance(value, dict):
                return value

        except (
            json.JSONDecodeError,
            TypeError,
            ValueError,
        ):
            pass

        return {}