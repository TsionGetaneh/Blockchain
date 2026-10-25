'use client'
import { useEffect, useRef, useState } from 'react'

const STATS = [
  { value: 14, suffix: '+', label: 'Blockchains Supported', icon: '⛓️' },
  { value: 50, suffix: 'M+', label: 'Addresses Indexed', icon: '🔍' },
  { value: 500, suffix: 'K+', label: 'Flagged Wallets', icon: '🚨' },
  { value: 1, suffix: 's', label: 'Response Time', icon: '⚡' },
]

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1800
        const steps = 60
        const increment = target / steps
        let current = 0
        const timer = setInterval(() => {
          current = Math.min(current + increment, target)
          setCount(Math.floor(current))
          if (current >= target) clearInterval(timer)
        }, duration / steps)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count}{suffix}</span>
}

export function StatsSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl p-6 text-center transition hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="mb-3 text-3xl">{s.icon}</div>
              <div className="text-3xl font-black text-white sm:text-4xl"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-sm" style={{ color: '#A1A1AA' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
