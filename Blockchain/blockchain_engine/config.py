from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


@dataclass(slots=True)
class ScannerConfig:
    ethereum_rpc_url: str = os.getenv("ETHEREUM_RPC_URL", "https://ethereum-rpc.publicnode.com").strip()
    bsc_rpc_url: str = os.getenv("BSC_RPC_URL", "https://bsc-rpc.publicnode.com").strip()
    polygon_rpc_url: str = os.getenv("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com").strip()
    arbitrum_rpc_url: str = os.getenv("ARBITRUM_RPC_URL", "https://arbitrum-one-rpc.publicnode.com").strip()
    sepolia_rpc_url: str = os.getenv("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com").strip()
    optimism_rpc_url: str = os.getenv("OPTIMISM_RPC_URL", "https://optimism-rpc.publicnode.com").strip()
    avalanche_rpc_url: str = os.getenv("AVALANCHE_RPC_URL", "https://avalanche-c-chain-rpc.publicnode.com").strip()
    fantom_rpc_url: str = os.getenv("QUICKNODE_FANTOM_URL", os.getenv("FANTOM_RPC_URL", "https://rpcapi.fantom.network")).strip()
    fantom_explorer_api_url: str = os.getenv("FANTOM_EXPLORER_API_URL", "https://api.etherscan.io/v2/api").strip()
    fantom_blockscout_api_url: str = os.getenv("FANTOM_BLOCKSCOUT_API_URL", "https://fantom.blockscout.com/api/v2").strip()
    base_rpc_url: str = os.getenv("BASE_RPC_URL", "https://base-rpc.publicnode.com").strip()
    celo_rpc_url: str = os.getenv("CELO_RPC_URL", "https://celo-rpc.publicnode.com").strip()
    gnosis_rpc_url: str = os.getenv("GNOSIS_RPC_URL", "https://gnosis-rpc.publicnode.com").strip()
    cronos_rpc_url: str = os.getenv("CRONOS_RPC_URL", "https://cronos-evm-rpc.publicnode.com").strip()
    moonbeam_rpc_url: str = os.getenv("QUICKNODE_MOONBEAM_URL", os.getenv("MOONBEAM_RPC_URL", "https://moonbeam-rpc.publicnode.com")).strip()
    moonbeam_blockscout_api_url: str = os.getenv("MOONBEAM_BLOCKSCOUT_API_URL", "https://moonbeam.blockscout.com/api/v2").strip()
    metis_rpc_url: str = os.getenv("QUICKNODE_METIS_URL", os.getenv("METIS_RPC_URL", "https://andromeda.metis.io/?owner=1088")).strip()
    metis_explorer_api_url: str = os.getenv("METIS_EXPLORER_API_URL", "https://api.routescan.io/v2/network/mainnet/evm/1088/etherscan/api").strip()
    metis_blockscout_api_url: str = os.getenv("METIS_BLOCKSCOUT_API_URL", "https://metis.blockscout.com/api/v2").strip()
    kava_rpc_url: str = os.getenv("QUICKNODE_KAVA_URL", os.getenv("KAVA_RPC_URL", "https://kava-evm-rpc.publicnode.com")).strip()
    kava_blockscout_api_url: str = os.getenv("KAVA_BLOCKSCOUT_API_URL", "https://kava.blockscout.com/api/v2").strip()
    sepolia_blockscout_api_url: str = os.getenv("SEPOLIA_BLOCKSCOUT_API_URL", "https://eth-sepolia.blockscout.com/api/v2").strip()
    solana_api_url: str = os.getenv("QUICKNODE_SOLANA_URL", os.getenv("SOLANA_API_URL", "https://api.mainnet-beta.solana.com")).strip()
    ethereum_explorer_api_url: str = os.getenv(
        "ETHEREUM_EXPLORER_API_URL",
        "https://api.etherscan.io/v2/api",
    ).strip()
    ethereum_blockscout_api_url: str = os.getenv(
        "ETHEREUM_BLOCKSCOUT_API_URL",
        "https://eth.blockscout.com/api/v2",
    ).strip()
    bsc_explorer_api_url: str = os.getenv(
        "BSC_EXPLORER_API_URL",
        "https://api.etherscan.io/v2/api",
    ).strip()
    bsc_blockscout_api_url: str = os.getenv("BSC_BLOCKSCOUT_API_URL", "").strip()
    polygon_explorer_api_url: str = os.getenv(
        "POLYGON_EXPLORER_API_URL",
        "https://api.etherscan.io/v2/api",
    ).strip()
    polygon_blockscout_api_url: str = os.getenv("POLYGON_BLOCKSCOUT_API_URL", "").strip()
    arbitrum_explorer_api_url: str = os.getenv(
        "ARBITRUM_EXPLORER_API_URL",
        "https://api.etherscan.io/v2/api",
    ).strip()
    arbitrum_blockscout_api_url: str = os.getenv(
        "ARBITRUM_BLOCKSCOUT_API_URL",
        "https://arbitrum.blockscout.com/api/v2",
    ).strip()
    explorer_api_key: str = os.getenv("EXPLORER_API_KEY", os.getenv("ETHERSCAN_API_KEY", "")).strip()
    alchemy_api_key: str = os.getenv("ALCHEMY_API_KEY", "").strip()
    quicknode_api_key: str = os.getenv("QUICKNODE_API_KEY", "").strip()
    quicknode_fantom_url: str = os.getenv("QUICKNODE_FANTOM_URL", "").strip()
    quicknode_moonbeam_url: str = os.getenv("QUICKNODE_MOONBEAM_URL", "").strip()
    quicknode_metis_url: str = os.getenv("QUICKNODE_METIS_URL", "").strip()
    quicknode_kava_url: str = os.getenv("QUICKNODE_KAVA_URL", "").strip()
    quicknode_solana_url: str = os.getenv("QUICKNODE_SOLANA_URL", "").strip()
    bitcoin_api_url: str = os.getenv("BITCOIN_API_URL", "https://blockstream.info/api").strip()
    data_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("BLOCKCHAIN_DATA_DIR", "./blockchain_engine/data").strip()
        ).resolve()
    )
    request_timeout: int = 10
    max_rpc_scan_blocks: int = int(os.getenv("MAX_RPC_SCAN_BLOCKS", "10"))
    request_retries: int = int(os.getenv("REQUEST_RETRIES", "1"))
    request_backoff_seconds: float = float(os.getenv("REQUEST_BACKOFF_SECONDS", "1.0"))
    ofac_sdn_url: str = os.getenv(
        "OFAC_SDN_URL",
        "https://www.treasury.gov/ofac/downloads/sdn.csv",
    ).strip()
    ofac_sdn_alt_url: str = os.getenv(
        "OFAC_SDN_ALT_URL",
        "https://home.treasury.gov/system/files/126/ofacsdn.csv",
    ).strip()
    phishing_feed_url: str = os.getenv(
        "PHISHING_FEED_URL",
        "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/hosts.txt",
    ).strip()
    ransomware_feed_url: str = os.getenv(
        "RANSOMWARE_FEED_URL",
        "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt",
    ).strip()
    darknet_feed_url: str = os.getenv(
        "DARKNET_FEED_URL",
        "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt",
    ).strip()

    def ensure_data_dir(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir
