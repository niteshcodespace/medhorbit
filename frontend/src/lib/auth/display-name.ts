/**
 * Derives a safe, compact label for the signed-in-state UI from a Better
 * Auth session user. Only ever reads `name` - never falls back to email,
 * id, or any other field, so a caller cannot accidentally widen exposure
 * just by passing a richer user object in. Returns null when there is no
 * usable name, so the caller can fall back to a generic "Signed in" label.
 */
export function getDisplayName(user: { name?: string | null } | null | undefined): string | null {
  const name = user?.name?.trim();
  return name ? name : null;
}

/**
 * Compact first-name label for tight nav UI, derived only from
 * getDisplayName's already-safe value - never reads email/id itself.
 * Falls back to null (caller shows a generic "Signed in" label) when
 * there is no usable name.
 */
export function getFirstName(user: { name?: string | null } | null | undefined): string | null {
  const displayName = getDisplayName(user);
  if (!displayName) return null;
  const [first] = displayName.split(/\s+/);
  return first || null;
}
