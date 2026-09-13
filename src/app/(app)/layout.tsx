/**
 * (app) route group — authenticated tenant app (doc §4 module screens).
 *
 * S01: pass-through scaffold.
 * S04: becomes the mobile-first shell (bottom nav + sticky footer + sidebar).
 * S05: adds the subscription-status banner slot.
 *
 * Routes here are tenant-scoped + role-guarded.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
