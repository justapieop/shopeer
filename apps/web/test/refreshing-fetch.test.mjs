import assert from "node:assert/strict";
import { test } from "node:test";
import { createRefreshingFetch } from "../src/shared/api/refreshing-fetch.ts";
import { proxyAuth } from "../src/_app/api/auth-proxy.ts";

const origin = "http://localhost:3000";
const unauthorized = () => Response.json({ message: "Expired" }, { status: 401 });
const makeRequest = (path = "/user/me", init) => new Request(`${origin}/api${path}`, { credentials: "include", ...init });

test("shares refresh across concurrent 401s and replays each request once", async () => {
  let release, refreshed = false, renewals = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const send = createRefreshingFetch(async (request) => {
    calls.push(new URL(request.url).pathname);
    if (request.url.endsWith("/auth/refresh")) {
      renewals++;
      assert.equal(request.method, "POST");
      assert.equal(request.credentials, "include");
      assert.equal(request.cache, "no-store");
      await gate;
      refreshed = true;
      return Response.json({ id: "buyer" });
    }
    return refreshed ? Response.json({ id: "buyer" }) : unauthorized();
  });
  const first = send(makeRequest());
  const second = send(makeRequest("/cart"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renewals, 1);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(calls.length, 5);
});

test("preserves POST bodies and credentials when retrying a rejected cart addition", async () => {
  const bodies = [];
  const send = createRefreshingFetch(async (request) => {
    if (request.url.endsWith("/auth/refresh")) return Response.json({});
    assert.equal(request.credentials, "include");
    bodies.push(await request.text());
    return bodies.length === 1 ? unauthorized() : Response.json({ totalQuantity: 2 });
  });
  const body = JSON.stringify({ productId: "book", quantity: 2 });
  assert.equal((await send(makeRequest("/cart/items", { method: "POST", body }))).status, 200);
  assert.deepEqual(bodies, [body, body]);
});

for (const status of [401, 403, 500]) {
  test(`handles refresh ${status} without replay or a loop`, async () => {
    let calls = 0;
    const send = createRefreshingFetch(async (request) => {
      calls++;
      return request.url.endsWith("/auth/refresh") ? new Response(null, { status }) : unauthorized();
    });
    if (status === 500) await assert.rejects(send(makeRequest()), /renewal unavailable/);
    else assert.equal((await send(makeRequest())).status, status);
    assert.equal(calls, 2);
  });
}

test("a second 401 ends recovery", async () => {
  let calls = 0;
  const send = createRefreshingFetch(async (request) => {
    calls++;
    return request.url.endsWith("/auth/refresh") ? Response.json({}) : unauthorized();
  });
  assert.equal((await send(makeRequest())).status, 401);
  assert.equal(calls, 3);
});

test("does not retry network failures, server errors, forbidden requests, or auth endpoints", async () => {
  for (const status of [403, 500]) {
    let calls = 0;
    const send = createRefreshingFetch(async () => { calls++; return new Response(null, { status }); });
    assert.equal((await send(makeRequest())).status, status);
    assert.equal(calls, 1);
  }
  for (const path of ["/auth/login", "/auth/register", "/auth/refresh"]) {
    let calls = 0;
    const send = createRefreshingFetch(async () => { calls++; return unauthorized(); });
    assert.equal((await send(makeRequest(path, { method: "POST" }))).status, 401);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const send = createRefreshingFetch(async () => { calls++; throw new Error("offline"); });
  await assert.rejects(send(makeRequest("/cart/items", { method: "POST", body: "{}" })), /offline/);
  assert.equal(calls, 1);
});

test("a delayed 401 after another renewal uses the new cookie without renewing again", async () => {
  let release, renewals = 0, calls = 0;
  const delayed = new Promise((resolve) => { release = resolve; });
  const send = createRefreshingFetch(async (request) => {
    if (request.url.endsWith("/auth/refresh")) { renewals++; return Response.json({}); }
    calls++;
    if (calls === 1) { await delayed; return unauthorized(); }
    if (calls === 2) return unauthorized();
    return Response.json({});
  });
  const slow = send(makeRequest());
  await send(makeRequest("/cart"));
  release();
  assert.equal((await slow).status, 200);
  assert.equal(renewals, 1);
});

test("cancelling one request does not cancel the shared refresh or replay that request", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const controller = new AbortController();
  let calls = 0;
  const send = createRefreshingFetch(async (request) => {
    calls++;
    if (request.url.endsWith("/auth/refresh")) { await gate; return Response.json({}); }
    return unauthorized();
  });
  const result = send(makeRequest("/cart", { signal: controller.signal }));
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  release();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(calls, 2);
});

test("the auth proxy scopes the refresh cookie to /api/auth/refresh and preserves cookie flags", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.ok(url.endsWith("/auth/login"));
    assert.equal(init.headers.get("content-type"), "application/json");
    assert.equal(init.cache, "no-store");
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", "access_token=access; Path=/; HttpOnly; SameSite=Strict; Secure");
    headers.append("Set-Cookie", "refresh_token=refresh; Max-Age=604800; Path=/auth/refresh; HttpOnly; SameSite=Strict; Secure");
    return Response.json({ id: "buyer" }, { status: 201, headers });
  };
  try {
    const result = await proxyAuth(makeRequest("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), "login");
    assert.equal(result.status, 201);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(result.headers.getSetCookie(), [
      "access_token=access; Path=/; HttpOnly; SameSite=Strict; Secure",
      "refresh_token=refresh; Max-Age=604800; Path=/api/auth/refresh; HttpOnly; SameSite=Strict; Secure",
    ]);
  } finally { globalThis.fetch = original; }
});
