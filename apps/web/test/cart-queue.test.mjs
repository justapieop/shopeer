import assert from "node:assert/strict";
import { test } from "node:test";
import { createCartQueue } from "../src/_pages/store/model/cart-queue.ts";

test("additions are serialized so cart totals cannot arrive out of order", async () => {
  let completeFirst;
  const firstRequest = new Promise((resolve) => { completeFirst = resolve; });
  const calls = [];
  const add = createCartQueue(async (id, quantity) => {
    calls.push([id, quantity]);
    if (id === "first") await firstRequest;
    return { id, quantity };
  });
  const first = add("first", 2);
  const second = add("second", 1);
  await Promise.resolve();
  assert.deepEqual(calls, [["first", 2]]);
  completeFirst();
  await first;
  assert.deepEqual(await second, { id: "second", quantity: 1 });
  assert.deepEqual(calls, [["first", 2], ["second", 1]]);
});

test("a failed addition is not retried and does not block later additions", async () => {
  const calls = [];
  const add = createCartQueue(async (id) => {
    calls.push(id);
    if (id === "failed") throw new Error("stock conflict");
    return id;
  });
  await assert.rejects(add("failed", 1), /stock conflict/);
  assert.equal(await add("next", 1), "next");
  assert.deepEqual(calls, ["failed", "next"]);
});

test("invalid quantities never reach the mutation API", async () => {
  let calls = 0;
  const add = createCartQueue(async () => { calls++; });
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(add("product", quantity));
  }
  assert.equal(calls, 0);
});
