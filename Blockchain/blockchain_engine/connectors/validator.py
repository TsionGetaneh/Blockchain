import re
import base58
import bech32
from eth_utils import to_checksum_address, is_hex_address

def validate_address(address: str, chain: str = "ethereum") -> dict:
    address = address.strip()
    
    # 1. EVM Validation (Ethereum, BSC, Polygon, Arbitrum)
    if re.match(r"^0x[a-fA-F0-9]{40}$", address):
        try:
            checksummed = to_checksum_address(address)
            return {
                "address": address,
                "is_valid": True,
                "chain_type": "evm",
                "normalized_address": checksummed,
                "is_checksum_valid": address == checksummed if any(c.isupper() for c in address[2:]) else True
            }
        except Exception as e:
            return {"address": address, "is_valid": False, "error": str(e)}

    # 2. Bitcoin Validation (1..., 3..., bc1...)
    if re.match(r"^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[02-9ac-hj-np-z]{8,87})$", address, re.IGNORECASE):
        try:
            if address.lower().startswith("bc1"):
                hrp, data, spec = bech32.bech32_decode(address)
                if hrp == "bc" and data is not None:
                    return {"address": address, "is_valid": True, "chain_type": "bitcoin", "format": "bech32"}
            else:
                decoded = base58.b58decode_check(address)
                if len(decoded) == 21:
                    return {"address": address, "is_valid": True, "chain_type": "bitcoin", "format": "base58"}
        except Exception as e:
            return {"address": address, "is_valid": False, "error": str(e)}

    # 3. Solana Validation (Base58 32-bytes)
    if re.match(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$", address):
        try:
            decoded = base58.b58decode(address)
            if len(decoded) == 32:
                return {"address": address, "is_valid": True, "chain_type": "solana"}
        except Exception as e:
            return {"address": address, "is_valid": False, "error": str(e)}

    return {"address": address, "is_valid": False, "error": "Unrecognized address format"}