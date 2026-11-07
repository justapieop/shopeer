import assert from "node:assert/strict";
import { test } from "node:test";
import { returnDestination } from "../src/_pages/login/lib/return-destination.ts";

test("returns buyers and sellers to their order after login", () => {
  assert.equal(returnDestination(new URLSearchParams("next=orders&orderId=placed-1")), "/orders/placed-1");
  assert.equal(returnDestination(new URLSearchParams("next=seller-orders&orderId=placed-1")), "/seller/orders/placed-1");
});
test("keeps login redirects on local allowlisted routes", () => {
  assert.equal(returnDestination(new URLSearchParams("next=https://evil.example")), "/");
  assert.equal(returnDestination(new URLSearchParams("next=orders&orderId=https://evil.example")), "/orders/https%3A%2F%2Fevil.example");
  assert.equal(returnDestination(new URLSearchParams("next=cart")), "/cart");
  assert.equal(returnDestination(new URLSearchParams("next=seller-products")), "/seller/products");
});
