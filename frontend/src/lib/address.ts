import type { ChainId } from './chains'

export function detectChain(address: string, currentChain: ChainId): ChainId {
  const a = address.trim()
  if (!a) return currentChain
  
  // 1. If it's a Bitcoin address, switch to Bitcoin
  if (isValidBitcoinAddress(a)) return 'bitcoin'
  
  // 2. If it's a Solana address, switch to Solana
  if (isValidSolanaAddress(a)) return 'solana'

  // Respect whatever chain the user selected!
  return currentChain
}

export function isValidEvmAddress(address: string): boolean {
  const a = address.trim()
  return /^0x[a-fA-F0-9]{40}$/.test(a)
}

export function isValidBitcoinAddress(address: string): boolean {
  const a = address.trim()
  return /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[ac-hj-np-z02-9]{11,71})$/.test(a)
}

export function isValidSolanaAddress(address: string): boolean {
  const a = address.trim()
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && !a.startsWith('0x')
}

export const isValidEthAddress = isValidEvmAddress

export function shortenAddress(address: string, head = 6, tail = 4): string {
  const a = address.trim()
  if (a.length <= head + tail + 3) return a
  return `${a.slice(0, head)}...${a.slice(-tail)}`
}

