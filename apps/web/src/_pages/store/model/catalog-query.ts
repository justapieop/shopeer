export const PAGE_SIZE = 12;
export type CatalogQuery = { page: number; categoryId: string };
export type StoreSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogQuery(params: StoreSearchParams): CatalogQuery {
  const rawPage = params["page"];
  const number = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(number) && number <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ? number : 1;
  const rawCategory = params["categoryId"];
  const categoryId = typeof rawCategory === "string" && rawCategory.length <= 256 ? rawCategory.trim() : "";
  return { page, categoryId };
}

export function catalogHref({ page, categoryId }: CatalogQuery): string {
  const query = new URLSearchParams();
  if (categoryId) query.set("categoryId", categoryId);
  if (page > 1) query.set("page", String(page));
  return `/store${query.size ? `?${query}` : ""}`;
}
