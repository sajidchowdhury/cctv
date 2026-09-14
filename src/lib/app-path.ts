export const APP_BASE_PATH = "/cctv";

export function appPath(path: string): string {
  if (!path) return APP_BASE_PATH;

  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
