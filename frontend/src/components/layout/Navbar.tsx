import Link from "next/link";
import { NAV_ITEMS } from "@/constants";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center h-20 px-6">

        <Link href="/" className="text-2xl font-bold text-white">
          🚀 MedhOrbit
        </Link>

        <div className="flex gap-8">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="text-gray-300 hover:text-white transition"
            >
              {item.title}
            </Link>
          ))}
        </div>

      </div>
    </nav>
  );
}