import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Hero } from "@/components/marketing/hero";
import { ProblemStatement } from "@/components/marketing/problem-statement";
import { FeatureStory } from "@/components/marketing/feature-story";
import { ArchitectureDiagram } from "@/components/marketing/architecture-diagram";
import { ScanChecks } from "@/components/marketing/scan-checks";
import { AlertsSection } from "@/components/marketing/alerts-section";
import { OpenSourceSection } from "@/components/marketing/open-source-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FinalCTA } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-ring/30 selection:text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <Hero />
        <ProblemStatement />
        <FeatureStory />
        <ArchitectureDiagram />
        <ScanChecks />
        <AlertsSection />
        <OpenSourceSection />
        <HowItWorks />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
