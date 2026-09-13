/**
 * (auth) route group — unauthenticated auth screens (doc §3.3).
 *
 * S01: pass-through scaffold.
 * S03: hosts /login, /signup, /verify-email, /change-email, /payment, /locked.
 *
 * No tenant context, no module access.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
