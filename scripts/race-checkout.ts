/**
 * Race-condition demo: many buyers check out the same scarce product at the
 * same moment, against the real server and database.
 *
 * Every buyer has the same two products in the cart:
 *   - SCARCE  (prod-flash-sale, stock 5 after seeding): only 5 buyers can win
 *   - PLENTY  (prod-clean-code, stock 50): enough for everybody
 *
 * Expected, if checkout is correct:
 *   1. exactly min(buyers, scarce stock) checkouts succeed, the others get 409
 *   2. SCARCE stock ends at (initial - successes) and never below 0
 *   3. PLENTY stock also drops by exactly `successes`: the losers' copies were
 *      put back, because a failed order changes nothing (all or nothing)
 *
 * Usage (server running, fresh stock):
 *   pnpm db:seed
 *   pnpm race              # 20 buyers
 *   pnpm race 50           # 50 buyers
 */

const BASE_URL: string = process.env["RACE_BASE_URL"] ?? "http://localhost:3000";
const BUYERS: number = Number(process.argv.slice(2).find((arg: string) => /^\d+$/.test(arg)) ?? 20);
const SCARCE: string = "prod-flash-sale";
const PLENTY: string = "prod-clean-code";

interface HttpResult {
  status: number;
  body: any;
}

async function call(method: string, path: string, userId?: string, body?: unknown): Promise<HttpResult> {
  const headers: Record<string, string> = { "content-type": "application/json", };

  if (userId) {
    // Temporary identity header, see CurrentUserId.decorator.ts
    headers["x-user-id"] = userId;
  }

  const response: Response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body), }),
  });
  const text: string = await response.text();

  return { status: response.status, body: text ? JSON.parse(text) : null, };
}

async function stockOf(productId: string): Promise<number> {
  const { status, body, } = await call("GET", `/products/${productId}`);

  if (status !== 200) {
    throw new Error(`Cannot read ${productId} (HTTP ${status}). Is the server running and seeded?`);
  }

  return body.stock;
}

async function createBuyer(index: number): Promise<string> {
  const username: string = `race${Date.now().toString(36)}${index}`;
  const { status, body, } = await call("POST", "/auth/register", undefined, { username, password: "Race@123456789", });

  if (status !== 201) {
    throw new Error(`Registration failed (HTTP ${status}): ${JSON.stringify(body)}`);
  }

  // Add the two products in a random order: the checkout must not deadlock
  // whatever order the cart was filled in.
  const products: string[] = Math.random() < 0.5 ? [SCARCE, PLENTY] : [PLENTY, SCARCE];

  for (const productId of products) {
    const added: HttpResult = await call("POST", "/cart/items", body.id, { productId, quantity: 1, });

    if (added.status !== 200) {
      throw new Error(`Add to cart failed (HTTP ${added.status}): ${JSON.stringify(added.body)}`);
    }
  }

  return body.id;
}

async function main(): Promise<void> {
  const scarceBefore: number = await stockOf(SCARCE);
  const plentyBefore: number = await stockOf(PLENTY);

  if (scarceBefore === 0 || plentyBefore < BUYERS) {
    throw new Error("Not enough stock to run the demo: run `pnpm db:seed` first.");
  }

  console.log(`Stock before: ${SCARCE}=${scarceBefore}, ${PLENTY}=${plentyBefore}`);
  console.log(`Preparing ${BUYERS} buyers (register + fill cart)...`);
  const buyers: string[] = await Promise.all(Array.from({ length: BUYERS, }, (_: unknown, i: number) => createBuyer(i)));

  console.log(`All ${BUYERS} buyers press "Checkout" at the same moment...`);
  const started: number = performance.now();
  const results: HttpResult[] = await Promise.all(buyers.map((userId: string) => call("POST", "/checkout", userId)));
  const elapsed: number = Math.round(performance.now() - started);

  const tally: Map<string, number> = new Map();

  for (const { status, body, } of results) {
    const key: string = status === 201 ? "201 order placed" : `${status} ${body?.error ?? ""}`.trim();
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  const successes: number = results.filter((result: HttpResult) => result.status === 201).length;
  const scarceAfter: number = await stockOf(SCARCE);
  const plentyAfter: number = await stockOf(PLENTY);

  console.log(`\nResults after ${elapsed} ms:`);

  for (const [key, count] of tally) {
    console.log(`  ${key}: ${count}`);
  }

  console.log(`Stock after:  ${SCARCE}=${scarceAfter}, ${PLENTY}=${plentyAfter}\n`);

  const checks: [string, boolean][] = [
    [`successful orders = min(buyers, stock) = ${Math.min(BUYERS, scarceBefore)}`, successes === Math.min(BUYERS, scarceBefore)],
    ["every other buyer got 409 Conflict", results.every((result: HttpResult) => result.status === 201 || result.status === 409)],
    [`${SCARCE} stock = ${scarceBefore} - ${successes}, never negative`, scarceAfter === scarceBefore - successes && scarceAfter >= 0],
    [`${PLENTY} stock dropped only for successful orders (failed orders rolled back)`, plentyAfter === plentyBefore - successes],
  ];

  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  }

  if (checks.some(([, ok]: [string, boolean]) => !ok)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
