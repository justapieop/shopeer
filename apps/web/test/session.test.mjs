import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionStore } from "../src/entities/session/model/session-store.ts";
import { createSessionMiddleware } from "../src/entities/session/model/session-middleware.ts";

const user = { id: "alice", username: "alice", createdAt: "2026-11-05T00:00:00.000Z", suspended: false };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

for (const result of [user, null]) {
  test(`shares one request and caches ${result ? "authenticated" : "anonymous"} results for five minutes`, async () => {
    let now = 1, calls = 0;
    const request = deferred();
    const store = createSessionStore(() => { calls++; return request.promise; }, () => now);
    const first = store.refresh();
    assert.equal(store.refresh(), first);
    assert.equal(calls, 1);
    request.resolve(result);
    await first;
    assert.equal(store.getSnapshot().status, result ? "authenticated" : "anonymous");
    now += 299_999;
    await store.refresh();
    assert.equal(calls, 1);
    now++;
    await store.refresh();
    assert.equal(calls, 2);
  });
}

test("login seeds the cache and a pending pre-login check cannot replace it", async () => {
  const request = deferred();
  let calls = 0;
  const store = createSessionStore(() => { calls++; return request.promise; });
  const check = store.refresh();
  store.setUser(user);
  request.resolve(null);
  await check;
  await store.refresh();
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().user, user);
});

test("clearing a session prevents an earlier request from restoring its user", async () => {
  const request = deferred();
  const store = createSessionStore(() => request.promise);
  const check = store.refresh();
  store.clearSession();
  request.resolve(user);
  await check;
  assert.equal(store.getSnapshot().status, "anonymous");
  assert.equal(store.getSnapshot().user, null);
});

test("an outage preserves the current user, backs off, and supports explicit retry", async () => {
  let now = 1, calls = 0;
  const store = createSessionStore(async () => { calls++; throw new Error("unavailable"); }, () => now);
  store.setUser(user);
  now += 300_000;
  await store.refresh();
  assert.equal(store.getSnapshot().user, user);
  assert.ok(store.getSnapshot().error);
  await store.refresh();
  assert.equal(calls, 1);
  await store.refresh(true);
  assert.equal(calls, 2);
  now += 30_000;
  await store.refresh();
  assert.equal(calls, 3);
});

test("an initial network failure is an error, not a logged-out session", async () => {
  const store = createSessionStore(async () => { throw new Error("offline"); });
  await store.refresh();
  assert.equal(store.getSnapshot().status, "error");
});

test("providers have isolated session state and a stable anonymous server snapshot", () => {
  const first = createSessionStore(async () => null);
  const second = createSessionStore(async () => null);
  const serverSnapshot = first.getServerSnapshot();
  first.setUser(user);
  assert.equal(second.getSnapshot().user, null);
  assert.equal(first.getServerSnapshot(), serverSnapshot);
  assert.equal(serverSnapshot.user, null);
});

test("protected request 401s clear the user; 403s and rejected logins do not", () => {
  const store = createSessionStore(async () => user);
  const middleware = createSessionMiddleware(store);
  store.setUser(user);
  for (const [status, schemaPath] of [[403, "/cart"], [401, "/auth/login"]]) {
    middleware.onRequest({ id: "preserve" });
    middleware.onResponse({ id: "preserve", schemaPath, response: new Response(null, { status }) });
    assert.equal(store.getSnapshot().user, user);
  }
  middleware.onRequest({ id: "expired" });
  middleware.onResponse({ id: "expired", schemaPath: "/cart", response: new Response(null, { status: 401 }) });
  assert.equal(store.getSnapshot().status, "anonymous");
});

test("a late 401 from before login cannot clear the new session", () => {
  const store = createSessionStore(async () => null);
  const middleware = createSessionMiddleware(store);
  middleware.onRequest({ id: "old-request" });
  store.setUser(user);
  middleware.onResponse({ id: "old-request", schemaPath: "/user/me", response: new Response(null, { status: 401 }) });
  assert.equal(store.getSnapshot().user, user);
});
