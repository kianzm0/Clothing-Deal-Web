import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { prisma } from "./prisma";
import { authOptions } from "./auth";
import { canEditCatalog } from "./roles";
import { getAllProducts, getProductById } from "./repository";
import { DEFAULT_PREFERENCES } from "./types";
import { POST as publish } from "../app/api/offers/publish/route";
import { POST as ingest } from "../app/api/offers/ingest/route";
import { POST as scavenge } from "../app/api/scavenge/route";
import { POST as dealLinks } from "../app/api/deal-links/route";
import { POST as signup } from "../app/api/signup/route";
import * as watchlist from "../app/api/watchlist/route";
import * as preferences from "../app/api/preferences/route";
import { POST as interact } from "../app/api/interactions/route";
import { GET as weights } from "../app/api/bandit-weights/route";
import ReviewPage from "../app/review/page";
import Nav from "../components/Nav";
import { parseRoleChange, setUserRole } from "../scripts/set-user-role";

// Mock only the session, database, and retailer network boundaries. Route handlers,
// permission checks, extraction, ingestion, callbacks, and components run unchanged.
const nextAuth = require("next-auth/next");
const restorations: Array<() => void> = [];
function stub(target: object, method: string, implementation: (...args: any[]) => any) {
  // Prisma delegates are proxies whose property descriptors omit method values;
  // assign a tracked function instead of using descriptor-based mock.method.
  const object = target as Record<string, (...args: any[]) => any>;
  const original = object[method];
  assert.equal(typeof original, "function", `Missing test boundary: ${method}`);
  const spy = mock.fn(implementation);
  object[method] = spy;
  restorations.push(() => { object[method] = original; });
  return spy;
}
const userSession = (role: Session["user"]["role"] = "USER"): Session => ({
  user: { id: "user-1", email: "customer@example.test", role },
  expires: "2099-01-01T00:00:00.000Z",
});
let session: Session | null;
let databaseRole: string | null;
let existingOffer: boolean;
const retailerUrl = "https://www.nike.com/t/test-shirt";
const offer = {
  id: "offer-1", productId: "product-1", store: "Nike", price: 20, originalPrice: 30,
  shippingCost: 0, sizesInStock: ["M"], lastUpdated: new Date(), url: retailerUrl,
  status: "active",
};
const product = {
  id: "product-1", name: "Test shirt", brand: "Nike", category: "T_SHIRT",
  colors: ["black"], sizes: ["M"], image: "https://www.nike.com/shirt.jpg", offers: [offer],
};
let productRead: ReturnType<typeof stub>;
let productList: ReturnType<typeof stub>;
let productCreate: ReturnType<typeof stub>;
let offerRead: ReturnType<typeof stub>;
let offerCreate: ReturnType<typeof stub>;
let offerUpdate: ReturnType<typeof stub>;
let network: ReturnType<typeof stub>;
let roleRead: ReturnType<typeof stub>;

beforeEach(() => {
  session = userSession();
  databaseRole = "USER";
  existingOffer = false;
  stub(nextAuth, "getServerSession", async () => session);
  roleRead = stub(prisma.user, "findUnique", async () => databaseRole === null ? null : {
    id: "user-1", email: "customer@example.test", role: databaseRole,
  });
  productRead = stub(prisma.product, "findUnique", async () => product);
  productList = stub(prisma.product, "findMany", async () => [product]);
  productCreate = stub(prisma.product, "create", async ({ data }) => data);
  offerRead = stub(prisma.offer, "findFirst", async () => existingOffer ? offer : null);
  offerCreate = stub(prisma.offer, "create", async ({ data }) => ({ id: "offer-new", ...data }));
  offerUpdate = stub(prisma.offer, "update", async ({ data }) => ({ ...offer, ...data }));
  network = stub(globalThis, "fetch", async () => new Response(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "Test shirt", brand: { name: "Nike" }, image: product.image,
    offers: { price: "20.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
  })}</script>`, { headers: { "content-type": "text/html" } }));
});
afterEach(() => {
  while (restorations.length) restorations.pop()!();
  mock.restoreAll();
});

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/api/test", {
    method, headers: { "content-type": "application/json", "x-user-role": "ADMIN" }, body: JSON.stringify(body),
  });
}
function noEditorialSideEffects() {
  for (const spy of [productRead, productList, productCreate, offerRead, offerCreate, offerUpdate, network]) {
    assert.equal(spy.mock.callCount(), 0);
  }
}
const routes = [
  { name: "publish new product", handler: publish, body: { url: retailerUrl, category: "t-shirt" }, status: 201 },
  { name: "publish existing product", handler: publish, body: { url: retailerUrl, productId: "product-1" }, status: 201 },
  { name: "ingest", handler: ingest, body: { url: retailerUrl, productId: "product-1" }, status: 201 },
  { name: "scavenge", handler: scavenge, body: { url: retailerUrl }, status: 200 },
  { name: "deal-links", handler: dealLinks, body: { urls: [retailerUrl] }, status: 207 },
];

for (const route of routes) {
  for (const caller of ["visitor", "customer", "deleted account", "unknown role"] as const) {
    test(`${route.name}: denies ${caller} before reading the body or causing side effects`, async () => {
      session = caller === "visitor" ? null : userSession("ADMIN");
      databaseRole = caller === "deleted account" ? null : caller === "unknown role" ? "OWNER" : "USER";
      const req = request({ ...route.body, role: "ADMIN", userId: "editor", overrides: { role: "ADMIN" } });
      const bodyRead = stub(req, "json", () => { throw new Error("Body must not be parsed"); });
      const res = await route.handler(req);
      assert.equal(res.status, caller === "visitor" ? 401 : 403);
      assert.equal(bodyRead.mock.callCount(), 0);
      if (caller === "visitor") assert.equal(roleRead.mock.callCount(), 0);
      else assert.deepEqual(roleRead.mock.calls[0].arguments[0], { where: { id: "user-1" }, select: { role: true } });
      noEditorialSideEffects();
    });
  }
  for (const role of ["EDITOR", "ADMIN"] as const) {
    test(`${route.name}: permits a database ${role} even with an old USER session`, async () => {
      databaseRole = role;
      const res = await route.handler(request(route.body));
      assert.equal(res.status, route.status, JSON.stringify(await res.clone().json()));
      assert.ok(network.mock.callCount() > 0);
      if (route.name === "publish new product") assert.equal(productCreate.mock.callCount(), 1);
      if (route.status === 201) assert.equal(offerCreate.mock.callCount(), 1);
      if (route.name === "deal-links") assert.equal((await res.json()).results[0].ok, true);
    });
  }
  test(`${route.name}: fails closed if the permission database is unavailable`, async () => {
    roleRead.mock.mockImplementation(async () => { throw new Error("Database unavailable"); });
    const res = await route.handler(request(route.body));
    assert.equal(res.status, 503);
    noEditorialSideEffects();
  });
}

for (const handler of [ingest, publish]) {
  test(`${handler === ingest ? "ingest" : "publish"}: editor can refresh an existing offer`, async () => {
    databaseRole = "EDITOR";
    existingOffer = true;
    const res = await handler(request({ url: retailerUrl, productId: "product-1", overrides: { priceCents: 1500 } }));
    assert.equal(res.status, 200);
    assert.equal(offerUpdate.mock.callCount(), 1);
    assert.equal(offerCreate.mock.callCount(), 0);
    assert.equal(productCreate.mock.callCount(), 0);
  });
}

test("revoking editorial access blocks the next request with the same session", async () => {
  session = userSession("EDITOR");
  databaseRole = "EDITOR";
  assert.equal((await scavenge(request({ url: retailerUrl }))).status, 200);
  databaseRole = "USER";
  assert.equal((await scavenge(request({ url: retailerUrl }))).status, 403);
  assert.equal(network.mock.callCount(), 1);
});

test("signup ignores an injected role and creates only a USER", async () => {
  roleRead.mock.mockImplementation(async () => null);
  const create = stub(prisma.user, "create", async ({ data }) => ({ id: "new-user", ...data }));
  const res = await signup(request({ email: "NEW@example.test", password: "example-password", name: "New", role: "ADMIN" }));
  assert.equal(res.status, 200);
  const data = create.mock.calls[0].arguments[0].data;
  assert.equal(data.role, "USER");
  assert.equal(data.email, "new@example.test");
  assert.notEqual(data.passwordHash, "example-password");
  assert.deepEqual(await res.json(), { id: "new-user", email: "new@example.test" });
});

test("session role comes from the database and ignores stale token/session role claims", async () => {
  const callback = authOptions.callbacks!.session!;
  const run = async () => await callback({ session: userSession("ADMIN"), token: { id: "user-1", role: "ADMIN" } } as unknown as Parameters<typeof callback>[0]) as Session;
  assert.equal((await run()).user.role, "USER");
  databaseRole = "EDITOR";
  assert.equal((await run()).user.role, "EDITOR");
  databaseRole = null;
  assert.equal((await run()).user.role, "USER");
  roleRead.mock.mockImplementation(async () => { throw new Error("offline"); });
  stub(console, "error", () => {});
  assert.equal((await run()).user.role, "USER");
});

test("JWT session updates cannot replace the authenticated user ID or grant a role", async () => {
  const callback = authOptions.callbacks!.jwt!;
  const token = await callback({ token: { id: "user-1" }, trigger: "update", session: { id: "editor", role: "ADMIN" } } as Parameters<typeof callback>[0]);
  assert.equal(token.id, "user-1");
  assert.equal(token.role, undefined);
});

for (const caller of ["visitor", "customer", "EDITOR", "ADMIN"] as const) {
  test(`review page: ${caller} receives the correct server-side access decision`, async () => {
    session = caller === "visitor" ? null : userSession();
    databaseRole = caller === "customer" ? "USER" : caller;
    if (caller === "visitor" || caller === "customer") {
      await assert.rejects(ReviewPage, (error: any) => String(error.digest).startsWith(caller === "visitor" ? "NEXT_REDIRECT" : "NEXT_NOT_FOUND"));
      noEditorialSideEffects();
    } else {
      const page = await ReviewPage();
      assert.equal(page.props.products[0].id, "product-1");
      assert.equal(productList.mock.callCount(), 1);
    }
  });
}

test("review page fails closed on database errors before loading products", async () => {
  roleRead.mock.mockImplementation(async () => { throw new Error("offline"); });
  await assert.rejects(ReviewPage, /offline/);
  noEditorialSideEffects();
});

test("navigation shows Review deal only for editors and administrators", () => {
  for (const role of [null, "USER", "EDITOR", "ADMIN"] as const) {
    const html = renderToStaticMarkup(React.createElement(SessionProvider, {
      session: role === null ? null : userSession(role),
      children: React.createElement(Nav),
    }));
    assert.equal(html.includes('href="/review"'), role === "EDITOR" || role === "ADMIN");
    for (const href of ["/", "/watchlist", "/preferences"]) assert.ok(html.includes(`href="${href}"`));
  }
  for (const role of [undefined, null, "USER", "editor", "OWNER", true, {}]) assert.equal(canEditCatalog(role), false);
});

test("customers retain watchlists, preferences, and personalized learning", async () => {
  const save = stub(prisma.watchlistItem, "upsert", async () => ({}));
  stub(prisma.watchlistItem, "findMany", async () => [{ productId: "product-1" }]);
  const remove = stub(prisma.watchlistItem, "deleteMany", async () => ({ count: 1 }));
  stub(prisma.preference, "findUnique", async () => DEFAULT_PREFERENCES);
  const prefs = stub(prisma.preference, "upsert", async () => ({}));
  stub(prisma.banditWeights, "findUnique", async () => null);
  const learn = stub(prisma.banditWeights, "upsert", async () => ({}));
  stub(prisma.interaction, "count", async () => 1);
  stub(prisma.interaction, "findMany", async () => []);
  const interaction = stub(prisma.interaction, "create", async () => ({}));
  assert.deepEqual((await (await watchlist.GET()).json()).ids, ["product-1"]);
  assert.equal((await watchlist.POST(request({ productId: "product-1" }))).status, 200);
  assert.equal((await watchlist.DELETE(request({ productId: "product-1" }, "DELETE"))).status, 200);
  assert.equal((await preferences.GET()).status, 200);
  assert.equal((await preferences.PUT(request(DEFAULT_PREFERENCES, "PUT"))).status, 200);
  assert.equal((await (await weights()).json()).signedIn, true);
  assert.equal((await (await interact(request({ productId: "product-1", action: "SAVE" }))).json()).trained, true);
  for (const spy of [save, remove, prefs, learn, interaction]) assert.equal(spy.mock.callCount(), 1);
  assert.equal(save.mock.calls[0].arguments[0].create.userId, "user-1");
  assert.equal(interaction.mock.calls[0].arguments[0].data.userId, "user-1");
  assert.equal(roleRead.mock.callCount(), 0);
});

test("public catalog browsing and signed-out recommendation defaults remain available", async () => {
  session = null;
  assert.equal((await getAllProducts()).length, 1);
  assert.equal((await getProductById("product-1"))?.id, "product-1");
  assert.equal((await (await weights()).json()).signedIn, false);
  assert.equal((await (await interact(request({}))).json()).trained, false);
  assert.equal((await (await watchlist.GET()).json()).signedIn, false);
  assert.equal((await (await preferences.GET()).json()).signedIn, false);
  assert.equal(roleRead.mock.callCount(), 0);
});

test("customer preferences cannot smuggle a nested user role update or another user ID into Prisma", async () => {
  const upsert = stub(prisma.preference, "upsert", async () => ({}));
  const res = await preferences.PUT(request({
    ...DEFAULT_PREFERENCES, userId: "editor", role: "ADMIN",
    user: { update: { role: "ADMIN" } },
  }, "PUT"));
  assert.equal(res.status, 200);
  assert.deepEqual(upsert.mock.calls[0].arguments[0], {
    where: { userId: "user-1" }, update: DEFAULT_PREFERENCES,
    create: { userId: "user-1", ...DEFAULT_PREFERENCES },
  });
});

test("role provisioning requires one explicit existing ID and a valid role", async () => {
  for (const args of [[], ["--role", "ADMIN"], ["--user-id", "user-1"], ["--user-id", "user-1", "--role", "owner"], ["--user-id", "user-1", "--role", "ADMIN", "--role", "EDITOR"], ["--email", "customer@example.test", "--role", "ADMIN"]]) {
    assert.throws(() => parseRoleChange(args), /Usage/);
  }
  const update = stub(prisma.user, "update", async () => ({}));
  const create = stub(prisma.user, "create", async () => { throw new Error("Must never create a user"); });
  for (const role of ["EDITOR", "ADMIN", "USER"]) {
    const result = await setUserRole(["--user-id", "user-1", "--role", role]);
    assert.equal(result.to, role);
    assert.deepEqual(update.mock.calls.at(-1)!.arguments[0], { where: { id: "user-1" }, data: { role } });
  }
  databaseRole = null;
  await assert.rejects(setUserRole(["--user-id", "missing", "--role", "ADMIN"]), /User not found/);
  assert.equal(update.mock.callCount(), 3);
  assert.equal(create.mock.callCount(), 0);
});
