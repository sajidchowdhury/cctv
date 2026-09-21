export const APP_BASE_PATH = "/cctv";

export function appPath(path: string): string {
  if (!path) return APP_BASE_PATH;

  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Resolve an uploaded-asset URL to a fully-renderable browser URL.
 *
 * Why this exists:
 *  - Next.js plain <img src> does NOT auto-prepend the /cctv basePath,
 *    unlike next/image or next/link. So a stored URL like "/api/uploads/x.jpg"
 *    would render as https://inventoryos.xyz/api/uploads/x.jpg → 404.
 *  - Legacy uploads (saved before the assetUrl refactor) are stored as
 *    "/uploads/<key>". Those weren't served by any route, so they 404'd too.
 *
 * This helper:
 *  - Leaves absolute http(s):// URLs untouched (e.g. CDN URLs in prod).
 *  - Rewrites legacy "/uploads/<key>" → "/api/uploads/<key>" so old DB rows
 *    still resolve correctly.
 *  - Prepends APP_BASE_PATH to root-relative paths.
 *  - Returns null for null/undefined input so callers can write
 *    `src={assetUrl(logo) ?? ""}` without conditionals.
 */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Absolute URL — leave alone (CDN / external).
  if (/^https?:\/\//i.test(url)) return url;

  // Legacy "/uploads/<key>" — rewrite to routed "/api/uploads/<key>".
  let normalized = url;
  if (normalized.startsWith("/uploads/")) {
    normalized = normalized.replace(/^\/uploads\//, "/api/uploads/");
  }

  // Ensure leading slash.
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;

  // Prepend basePath.
  return appPath(normalized);
}
