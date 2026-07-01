
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white">
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
          🚀 Welcome to MedhOrbit
        </span>

        <h1 className="mb-6 text-6xl font-extrabold tracking-tight">
          Learn Smarter.
          <br />
          Grow Brighter.
        </h1>

        <p className="mb-10 max-w-2xl text-xl text-slate-300">
          AI-powered worksheets, quizzes and learning tools designed for
          students, parents and teachers.
        </p>

        <div className="flex gap-4">
          <button className="rounded-xl bg-blue-600 px-8 py-4 font-semibold transition hover:bg-blue-700">
            Generate Worksheet
          </button>

          <button className="rounded-xl border border-slate-600 px-8 py-4 hover:bg-slate-800">
            Learn More
          </button>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
            <h3 className="mb-2 text-xl font-bold">📚 CBSE Ready</h3>
            <p className="text-slate-400">
              Worksheets aligned with the latest CBSE curriculum.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
            <h3 className="mb-2 text-xl font-bold">🤖 AI Powered</h3>
            <p className="text-slate-400">
              Generate unique questions in seconds.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
            <h3 className="mb-2 text-xl font-bold">👨‍👩‍👧 For Everyone</h3>
            <p className="text-slate-400">
              Built for students, parents and teachers.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
} 