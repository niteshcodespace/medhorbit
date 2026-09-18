import Link from "next/link";
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

        <ul className="hidden items-center gap-4 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClassName}>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>

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
        </details>
      </Container>
    </nav>
  );
}
