"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { getFirstName } from "@/lib/auth/display-name";
import { buttonClassName } from "@/components/ui/Button";
import { COLORS, TYPOGRAPHY } from "@/constants";

const linkClassName = `inline-flex min-h-11 items-center rounded-md px-2 py-2 ${COLORS.text.secondary} hover:text-white`;

/**
 * Navbar auth widget. Presentation only: it reflects whatever
 * useSession() reports from the server's own session cookie, and never
 * reads or sends a user id - sign-in/sign-out are plain Better Auth calls
 * with no identity payload. API authorization is entirely server-side
 * (9D-4B); this component cannot grant or influence it.
 */
export default function AuthStatus() {
  const { data, isPending } = authClient.useSession();
  const pathname = usePathname();

  if (isPending) {
    // Fixed-width placeholder avoids a layout jump once the real state loads.
    return <span className={`${linkClassName} invisible`} aria-hidden="true">Sign in</span>;
  }

  if (!data) {
    return (
      <button
        type="button"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: pathname })}
        className={buttonClassName({ variant: "outline", size: "sm" })}
      >
        Sign in
      </button>
    );
  }

  const firstName = getFirstName(data.user);

  return (
    <div className="flex items-center gap-3">
      <span className={`${TYPOGRAPHY.small} ${COLORS.text.secondary} hidden sm:inline`}>
        {firstName ?? "Signed in"}
      </span>
      <Link href="/worksheets/saved" className={linkClassName}>
        My Worksheets
      </Link>
      <button
        type="button"
        onClick={() =>
          authClient.signOut({
            fetchOptions: {
              // A full browser navigation (not router.push()) is required
              // here: SavedWorksheetsList holds its fetched worksheets in
              // client-side React state that a route change alone does not
              // reset, so without this the previous account's data could
              // stay on screen. Navigating to "/" discards the whole app
              // (and any stale authenticated client state with it) and
              // lands the user on the signed-out home page.
              onSuccess: () => window.location.assign("/"),
            },
          })
        }
        className={buttonClassName({ variant: "outline", size: "sm" })}
      >
        Sign out
      </button>
    </div>
  );
}
