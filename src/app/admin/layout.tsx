/**
 * admin layout — super-admin control plane (doc §3.3.1).
 * Separate from the tenant (app) shell. No tenant context.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
