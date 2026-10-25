'use client'

import { ScrollProgress } from './ScrollProgress'
import { LandingNav } from './LandingNav'
import { HeroSection } from './HeroSection'
import { DashboardPreview } from './DashboardPreview'
import { StatsSection } from './StatsSection'
import { FeaturesSection } from './FeaturesSection'
import { HowItWorks } from './HowItWorks'
import { UseCases } from './UseCases'
import { PricingSection } from './PricingSection'
import { Testimonials } from './Testimonials'
import { FinalCTA } from './FinalCTA'
import { LandingFooter } from './LandingFooter'

export function LandingPage() {
  return (
    <div style={{ background: '#0A0A0F', color: '#e5e7eb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <ScrollProgress />
      <LandingNav />
      <main>
        <HeroSection />
        <DashboardPreview />
        <StatsSection />
        <FeaturesSection />
        <HowItWorks />
        <UseCases />
        <PricingSection />
        <Testimonials />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  )
}
