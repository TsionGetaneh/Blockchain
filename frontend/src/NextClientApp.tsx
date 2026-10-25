'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', background: '#0b0b10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '2px solid rgba(124,58,237,0.2)',
          borderTopColor: '#7c3aed',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '13px', color: '#6b7280' }}>Loading platform…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
})

export function NextClientApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(17,17,17,0.9)',
            color: 'rgba(229,231,235,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            backdropFilter: 'blur(10px)',
          },
        }}
      />
    </QueryClientProvider>
  )
}
