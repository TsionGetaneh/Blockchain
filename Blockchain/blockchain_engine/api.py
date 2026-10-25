from __future__ import annotations

import json
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import asdict, is_dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from blockchain_engine.config import ScannerConfig
from blockchain_engine.scanner import BlockchainScanner

# Errors raised when the client closes the connection before we finish writing
_BROKEN_PIPE = (BrokenPipeError, ConnectionAbortedError, ConnectionResetError)


def run_api_server(host: str = "127.0.0.1", port: int = 8055) -> None:
    config = ScannerConfig()
    scanner = BlockchainScanner(config)
    executor = ThreadPoolExecutor(max_workers=10)
    route_timeout = 25.0

    class ApiHandler(BaseHTTPRequestHandler):
        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(200)
            self._add_cors_headers()
            self.end_headers()

        def _run_with_timeout(self, func, timeout: float | None = None):
            future = executor.submit(func)
            try:
                return future.result(timeout=timeout or route_timeout)
            except TimeoutError:
                raise TimeoutError("Request timed out")

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            print(f"[API] incoming GET {self.path}")

            try:
                if parsed.path == "/health":
                    self._send_json({"status": "ok", "version": "1.0.0"})
                    print(f"[API] responded /health")
                    return

                if parsed.path == "/health/chains":
                    payload = self._run_with_timeout(lambda: scanner.get_chain_health())
                    self._send_json({"chains": payload})
                    return

                if parsed.path == "/screen":
                    print(f"[API] handling /screen")
                    t0 = __import__('time').time()
                    payload = self._run_with_timeout(
                        lambda: scanner.screen_address(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                        )
                    )
                    elapsed = __import__('time').time() - t0
                    self._send_json(payload, dataclass_like=True)
                    print(f"[API] responded /screen in {elapsed:.2f}s")
                    return

                if parsed.path == "/explore/address":
                    print(f"[API] handling /explore/address {query}")
                    t0 = __import__('time').time()
                    payload = self._run_with_timeout(
                        lambda: scanner.explore_address(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                            limit=int(query.get("limit", ["50"])[0]),
                        )
                    )
                    elapsed = __import__('time').time() - t0
                    tx_count = len(payload.get('transactions', [])) if isinstance(payload, dict) else 0
                    print(f"[API] /explore/address got {tx_count} items in {elapsed:.2f}s")
                    self._send_json(payload)
                    return

                if parsed.path == "/explore/tx":
                    payload = scanner.explore_transaction(_single(query, "tx_hash"))
                    self._send_json(
                        payload or {"message": "not found"},
                        status=200 if payload else 404,
                    )
                    return

                if parsed.path == "/graph":
                    payload = self._run_with_timeout(
                        lambda: scanner.build_graph(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                            limit=int(query.get("limit", ["50"])[0]),
                        )
                    )
                    self._send_json(payload)
                    return

                if parsed.path == "/cluster":
                    payload = self._run_with_timeout(
                        lambda: scanner.cluster_address(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                            limit=int(query.get("limit", ["50"])[0]),
                        )
                    )
                    self._send_json(payload)
                    return

                if parsed.path == "/risk":
                    print(f"[API] handling /risk {query}")
                    t0 = __import__('time').time()
                    payload = self._run_with_timeout(
                        lambda: scanner.scan_address(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                            limit=int(query.get("limit", ["50"])[0]),
                        )
                    )
                    elapsed = __import__('time').time() - t0
                    print(f"[API] /risk completed scan, score={payload.score} in {elapsed:.2f}s")
                    self._send_json(payload, dataclass_like=True)
                    return

                if parsed.path == "/alerts":
                    payload = self._run_with_timeout(
                        lambda: scanner.evaluate_alerts(
                            chain=_single(query, "chain"),
                            address=_single(query, "address"),
                            limit=int(query.get("limit", ["50"])[0]),
                        )
                    )
                    self._send_json(payload)
                    return

                if parsed.path == "/watchlist":
                    payload = scanner.watchlist.list_entries()
                    self._send_json(payload)
                    return

                if parsed.path == "/feeds/sync":
                    result = self._run_with_timeout(lambda: scanner.sync_public_feeds(), timeout=60)
                    self._send_json({"synced": result})
                    return

                self._send_json({"error": "not found"}, status=404)

            except TimeoutError as exc:
                print(f"[API] TIMEOUT on {parsed.path}: {exc}")
                self._send_json({"error": "Engine timeout — the blockchain lookup took too long. Try again.", "timeout": True}, status=504)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
            except _BROKEN_PIPE:
                # Client disconnected — nothing to do
                pass
            except Exception as exc:  # pragma: no cover
                traceback.print_exc(file=sys.stderr)
                try:
                    self._send_json({"error": str(exc)}, status=500)
                except _BROKEN_PIPE:
                    pass

        def log_message(self, format: str, *args: object) -> None:
            return

        def _add_cors_headers(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

        def _send_json(
            self,
            payload: object,
            *,
            status: int = 200,
            dataclass_like: bool = False,
        ) -> None:
            def _json_default(obj: object) -> object:
                if is_dataclass(obj):
                    return asdict(obj)
                if hasattr(obj, "isoformat"):
                    return obj.isoformat()
                return str(obj)

            body = json.dumps(
                payload,
                default=_json_default,
                indent=2,
            )
            encoded = body.encode("utf-8")
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self._add_cors_headers()
                self.end_headers()
                self.wfile.write(encoded)
            except _BROKEN_PIPE:
                pass

    server = ThreadingHTTPServer((host, port), ApiHandler)
    print(f"[+] Blockchain Engine API running on http://{host}:{port}")
    print(f"   Endpoints: /health /screen /risk /explore/address /graph /cluster /alerts /watchlist /feeds/sync")
    server.serve_forever()


def _single(query: dict[str, list[str]], key: str) -> str:
    value = query.get(key, [""])[0]
    if not value:
        raise ValueError(f"Missing query parameter: {key}")
    return value

if __name__ == "__main__":
    run_api_server()