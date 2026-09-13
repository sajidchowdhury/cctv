/**
 * admin route group — super-admin control plane (doc §3.3.1).
 *
 * S01: pass-through scaffold.
 * S05: hosts /admin/verifications (payment verification queue), tenant management.
 *
 * Super-admin only — separate from tenant RBAC.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
