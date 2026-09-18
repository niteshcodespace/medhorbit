import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:p-4"
      >
        Skip to main content
      </a>
      <Navbar />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <Hero />
        <Features />
      </main>

      <Footer />
    </>
  );
}
