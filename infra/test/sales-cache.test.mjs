import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { Product } from "@shopeer/domain";
import { ProductController } from "../dist/nest/modules/product/Product.controller.js";

it("expires serialized catalog stock without waiting for cache invalidation", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  let cached, loads = 0;
  const controller = new ProductController({ listProducts: async () => {
    loads++;
    return [new Product({ productId: "cup", name: "Cup", description: "Ceramic cup", price: 100, categoryId: "home", stock: 8, imageUrl: "image", saleId: "period", saleEndsAt: new Date(Date.now() + 1000) })];
  } }, { getOrLoad: async (_namespace, _key, load) => {
    if (!cached) cached = JSON.stringify(await load());
    return JSON.parse(cached);
  } });
  assert.equal((await controller.listProducts({ page: 1, limit: 20 }))[0].stock, 8);
  context.mock.timers.tick(1000);
  assert.equal((await controller.listProducts({ page: 1, limit: 20 }))[0].stock, 0);
  assert.equal(loads, 1);
});
