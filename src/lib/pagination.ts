/**
 * Shared pagination helpers for report API routes.
 *
 * Usage in an API route:
 *   const { page, pageSize, skip, take, q } = parsePagination(req);
 *   const [rows, total] = await Promise.all([
 *     db.model.findMany({ where, take, skip, orderBy }),
 *     db.model.count({ where }),
 *   ]);
 *   return NextResponse.json(paginateResponse({ rows, total, page, pageSize }));
 *
 * The frontend receives:
 *   { rows: [...], total, page, pageSize, totalPages }
 *
 * For search: `q` is the free-text search term (trimmed, may be empty string).
 * The route handler decides which fields to search (name, sku, invoiceNo, etc.)
 * by building a Prisma `where` clause with `contains` filters.
 */

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export type PaginationParams = {
  page: number;       // 1-based
  pageSize: number;   // items per page
  skip: number;       // Prisma skip (offset)
  take: number;       // Prisma take (limit)
  q: string;          // search term (trimmed, "" if not provided)
};

export type PaginatedResponse<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Parse pagination + search params from a Next.js Request URL.
 * Accepts: ?page=1&pageSize=50&q=search+term
 * Clamps to safe bounds.
 */
export function parsePagination(req: Request): PaginationParams {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const q = (url.searchParams.get("q") ?? "").trim();
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q,
  };
}

/**
 * Build the standard paginated response envelope.
 */
export function paginateResponse<T>(
  rows: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Helper for in-memory pagination (for routes that build entries in JS
 * by merging multiple queries — e.g. customer-ledger, cash-book).
 * Slices the array for the current page + returns the full total.
 */
export function paginateArray<T>(
  arr: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const total = arr.length;
  const start = (page - 1) * pageSize;
  const rows = arr.slice(start, start + pageSize);
  return paginateResponse(rows, total, page, pageSize);
}
