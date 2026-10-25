import type { ChainId } from './chains'

export function explorerTxUrl(chain: ChainId | string, txHash: string): string {
  if (!txHash) return '#'
  const c = (chain || 'ethereum').toLowerCase()
  switch (c) {
    case 'bsc':
      return `https://bscscan.com/tx/${txHash}`
    case 'polygon':
      return `https://polygonscan.com/tx/${txHash}`
    case 'arbitrum':
      return `https://arbiscan.io/tx/${txHash}`
    case 'optimism':
      return `https://optimistic.etherscan.io/tx/${txHash}`
    case 'base':
      return `https://basescan.org/tx/${txHash}`
    case 'avalanche':
      return `https://snowtrace.io/tx/${txHash}`
    case 'gnosis':
      return `https://gnosisscan.io/tx/${txHash}`
    case 'fantom':
      return `https://ftmscan.com/tx/${txHash}`
    case 'bitcoin':
      return `https://mempool.space/tx/${txHash}`
    case 'sepolia':
      return `https://sepolia.etherscan.io/tx/${txHash}`
    case 'ethereum':
    default:
      return `https://etherscan.io/tx/${txHash}`
  }
}


