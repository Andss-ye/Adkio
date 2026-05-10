import NoiseFilter from '../components/ui/NoiseFilter';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import MenuBar from '../components/landing/MenuBar';
import Inboxes from '../components/landing/Inboxes';
import AgentSection from '../components/landing/AgentSection';
import FeatureTriage from '../components/landing/FeatureTriage';
import StatusQuo from '../components/landing/StatusQuo';
import Pricing from '../components/landing/Pricing';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

const BG_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white">
      {/* Root SVG noise filter — referenced by gradientStyle.filter: url(#c3-noise) */}
      <NoiseFilter />

      {/* Fixed background video + dark wash */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none"
          src={BG_VIDEO}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/40 via-[#0c0c0c]/55 to-[#0c0c0c]/80" />
      </div>

      {/* Guide lines */}
      <div className="hidden md:block pointer-events-none fixed inset-y-0 left-1/2 -translate-x-[calc(50%+36rem)] w-px bg-white/10 z-[5]" />
      <div className="hidden md:block pointer-events-none fixed inset-y-0 left-1/2 translate-x-[calc(-50%+36rem)] w-px bg-white/10 z-[5]" />

      {/* Content */}
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <MenuBar />
        <Inboxes />
        <AgentSection />
        <FeatureTriage />
        <StatusQuo />
        <Pricing />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
