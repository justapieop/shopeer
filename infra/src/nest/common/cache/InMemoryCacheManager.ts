import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import type { Cache } from "@nestjs/cache-manager";

export type CacheNamespace = "catalog:products" | "catalog:categories";

const CATALOG_CACHE_TTL_MS: number = 30_000;

@Injectable()
export class InMemoryCacheManager {
  private readonly generations: Map<CacheNamespace, number> = new Map();

  public constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) { }

  public getOrLoad<T>(
    namespace: CacheNamespace,
    key: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const generation: number = this.generations.get(namespace) ?? 0;
    const cacheKey: string = `${namespace}:v${generation}:${key}`;
    return this.cache.wrap(cacheKey, load, CATALOG_CACHE_TTL_MS);
  }

  public invalidate(namespace: CacheNamespace): void {
    this.generations.set(namespace, (this.generations.get(namespace) ?? 0) + 1);
  }

  public invalidateProducts(): void {
    this.invalidate("catalog:products");
  }

  public invalidateCategories(): void {
    this.invalidate("catalog:categories");
  }
}
