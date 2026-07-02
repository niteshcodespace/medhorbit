import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white">
        <Hero />
        <Features />
      </main>

      <Footer />
    </>
  );
}