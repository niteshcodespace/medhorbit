import Link from "next/link";
import AuthStatus from "@/components/layout/AuthStatus";
import Container from "@/components/common/Container";
import { COLORS, NAV_ITEMS } from "@/constants";

const linkClassName = `inline-flex min-h-11 items-center rounded-md px-2 py-2 ${COLORS.text.secondary} hover:text-white`;

export default function Navbar() {
  return (
    <nav aria-label="Main navigation" className="w-full border-b border-white/10">
      <Container className="flex flex-wrap items-center justify-between gap-x-4">
        <Link href="/" className="flex min-h-20 items-center gap-2 rounded-md text-xl font-bold sm:text-2xl">
          <span aria-hidden="true">🚀</span> MedhOrbit
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <ul className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClassName}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
          <AuthStatus />
        </div>

        <details className="w-full pb-4 md:hidden">
          <summary className="min-h-11 cursor-pointer rounded-md px-2 py-3 font-semibold">
            Menu
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`${linkClassName} w-full`}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 px-2">
            <AuthStatus />
          </div>
        </details>
      </Container>
    </nav>
  );
}
