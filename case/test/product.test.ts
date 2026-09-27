import { Category, NotFoundError, Product } from "@shopeer/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { ProductUseCase } from "../src/product.js";
import { InMemoryCategoryRepository, InMemoryProductRepository, makeProduct } from "./fakes.js";

describe("ProductUseCase", () => {
  let useCase: ProductUseCase;

  beforeEach(() => {
    const products: InMemoryProductRepository = new InMemoryProductRepository();
    const categories: InMemoryCategoryRepository = new InMemoryCategoryRepository();
    useCase = new ProductUseCase(products, categories);

    categories.save(new Category({ categoryId: "books", name: "Books", }));
    categories.save(new Category({ categoryId: "shoes", name: "Shoes", }));
    products.save(makeProduct("novel", 90_000, 3, "books"));
    products.save(makeProduct("sneaker", 500_000, 2, "shoes"));
  });

  it("lists every product", async () => {
    expect(await useCase.listProducts()).toHaveLength(2);
  });

  it("filters products by category", async () => {
    const products: Product[] = await useCase.listProducts("books");

    expect(products.map((product: Product) => product.productId)).toEqual(["novel"]);
  });

  it("rejects an unknown category", async () => {
    await expect(useCase.listProducts("toys")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns one product or NotFoundError", async () => {
    expect((await useCase.getProduct("novel")).price).toBe(90_000);
    await expect(useCase.getProduct("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists categories", async () => {
    expect(await useCase.listCategories()).toHaveLength(2);
  });
});

describe("Product (domain)", () => {
  it("knows whether its stock covers a quantity", () => {
    const product: Product = makeProduct("p", 1_000, 2);

    expect(product.hasEnoughStock(2)).toBe(true);
    expect(product.hasEnoughStock(3)).toBe(false);
  });

  it.each([
    ["a zero price", { price: 0, }],
    ["a decimal price", { price: 1.5, }],
    ["a negative stock", { stock: -1, }],
  ])("rejects %s", (_label: string, override: Partial<{ price: number; stock: number }>) => {
    expect(() => new Product({
      productId: "p",
      name: "P",
      description: "D",
      price: 1_000,
      categoryId: "c",
      stock: 1,
      imageUrl: "u",
      ...override,
    })).toThrow();
  });
});
