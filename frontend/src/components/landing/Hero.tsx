import Button from "@/components/ui/Button";

export default function Hero() {
  return (
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
        <Button>Generate Worksheet</Button>

        <button className="rounded-xl border border-slate-600 px-8 py-3 hover:bg-slate-800">
          Learn More
        </button>
      </div>
    </section>
  );
}