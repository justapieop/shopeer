import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogHref, parseCatalogQuery, PAGE_SIZE } from "../src/_pages/store/model/catalog-query.ts";

test("malformed and repeated page parameters cannot produce invalid API offsets", () => {
  for (const page of ["0", "-1", "1.5", "1e3", "Infinity", "", "9007199254740991", ["1", "2"]]) {
    assert.equal(parseCatalogQuery({ page }).page, 1);
  }
  const { page } = parseCatalogQuery({ page: "23" });
  assert.equal(page, 23);
  assert.ok(Number.isSafeInteger((page - 1) * PAGE_SIZE));
});

test("pagination keeps the category, while selecting another category resets the page", () => {
  assert.equal(catalogHref({ page: 2, categoryId: "cat-books" }), "/store?categoryId=cat-books&page=2");
  assert.equal(catalogHref({ page: 1, categoryId: "cat-fashion" }), "/store?categoryId=cat-fashion");
  assert.equal(catalogHref({ page: 1, categoryId: "" }), "/store");
});

test("category IDs are encoded as data rather than extra query parameters", () => {
  const categoryId = "books & games#new";
  const url = new URL(catalogHref({ page: 3, categoryId }), "http://localhost");
  assert.equal(url.searchParams.get("categoryId"), categoryId);
  assert.equal(url.hash, "");
  assert.deepEqual(parseCatalogQuery({ categoryId: ["books", "games"] }), { page: 1, categoryId: "" });
});
