import { LandingNavbar } from "@/components/landing/landing-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesGrid />
      </main>
      <LandingFooter />
    </div>
  );
}
