import { test } from "node:test";
import assert from "node:assert/strict";
import { smoke } from "./smoke.mjs";
import { deployRender } from "./deploy-render.mjs";
import { checkWebConfig } from "../../infra/deploy/check-web-config.mjs";
import { cleanupProofs } from "./cleanup-proofs.mjs";
import { verifyJourney } from "./verify-journey.mjs";

test("smoke exige JSON da API e SHA da revisão candidata", async () => {
  const valid = async url => Response.json(url.endsWith("healthz")
    ? { status: "ok", service: "entregaprova-api", revision: "sha-esperado" } : { status: "ready" });
  assert.equal((await smoke("https://candidate.example", "sha-esperado", valid)).length, 2);
  await assert.rejects(smoke("https://candidate.example", "sha-errado", valid), /outra revisão/);
  await assert.rejects(smoke("https://candidate.example", undefined, async () => new Response("<html>SPA</html>")), /Content-Type/);
  await assert.rejects(smoke("https://candidate.example", undefined, async () => Response.json({ status: "unavailable" }, { status: 503 })), /503/);
});

test("Render solicita o SHA aprovado e espera a revisão nova, sem confundir hook com deploy pronto", async () => {
  const revision = "a".repeat(40);
  const env = { RENDER_DEPLOY_HOOK_URL: "https://api.render.com/deploy/srv-synthetic?key=synthetic", TARGET_API_URL: "https://api.example", EXPECTED_API_REVISION: revision };
  let ready = false;
  let calls = 0;
  const fetcher = async (url, init) => {
    calls++;
    if (init.method === "POST") {
      assert.equal(new URL(url).searchParams.get("ref"), revision);
      return Response.json({}, { status: 202 });
    }
    return Response.json(String(url).endsWith("healthz")
      ? { status: "ok", service: "entregaprova-api", revision: ready ? revision : "old" }
      : { status: "ready" });
  };
  assert.equal((await deployRender(env, fetcher, async () => { ready = true; })).length, 2);
  assert.equal(calls, 4);
  await assert.rejects(deployRender(env, async () => new Response("", { status: 401 })), /recusou deploy/);
  await assert.rejects(deployRender(env, async () => { throw new Error(env.RENDER_DEPLOY_HOOK_URL); }), error => !error.message.includes("synthetic"));
});

test("jornada verifica a revisão, baixa o comprovante e só então aprova", async () => {
  const tenantId = "homologacao-smoke";
  const token = role => `fake.${Buffer.from(JSON.stringify({ tenantId, role, sub: role })).toString("base64url")}.fake`;
  const env = {
    TARGET_API_URL: "https://api.example",
    EXPECTED_API_REVISION: "a".repeat(40),
    TEST_SMOKE_TENANT: tenantId,
    TEST_OPERATOR_TOKEN: token("operator"),
    TEST_DRIVER_TOKEN: token("driver"),
    SMOKE_WRITE_ENABLED: "true",
  };
  const signedUrl = "https://storage.example/comprovante?token=synthetic";
  let route, photo;
  const steps = [
    (url) => {
      assert.equal(url.pathname, "/healthz");
      return Response.json({ status: "ok", service: "entregaprova-api", revision: env.EXPECTED_API_REVISION });
    },
    (url) => {
      assert.equal(url.pathname, "/readyz");
      return Response.json({ status: "ready" });
    },
    (url, init) => {
      assert.equal(url.pathname, "/api/v1/entregas/xml");
      assert.equal(init.headers.Authorization, `Bearer ${env.TEST_OPERATOR_TOKEN}`);
      const { xmlContent, driverId } = JSON.parse(init.body);
      const key = /Id="NFe(\d{44})"/.exec(xmlContent)?.[1];
      assert.ok(key);
      assert.equal(driverId, "driver");
      route = `/api/v1/entregas/${key}`;
      return Response.json({}, { status: 201 });
    },
    async (url, init) => {
      assert.equal(url.pathname, `${route}/comprovantes`);
      assert.equal(init.headers.Authorization, `Bearer ${env.TEST_DRIVER_TOKEN}`);
      assert.ok(init.headers["Idempotency-Key"]);
      photo = await init.body.get("foto").arrayBuffer();
      return Response.json({ status: "COMPROVADO" });
    },
    (url) => {
      assert.equal(url.pathname, route);
      return Response.json({ status: "COMPROVADO", comprovante: { arquivoDisponivel: true, arquivoUrl: signedUrl } });
    },
    (url, init) => {
      assert.equal(url.href, signedUrl);
      assert.equal(new Headers(init.headers).has("authorization"), false);
      return new Response(photo);
    },
    (url, init) => {
      assert.equal(url.pathname, `${route}/conferencia`);
      assert.deepEqual(JSON.parse(init.body), { decisao: "APROVAR" });
      return Response.json({ status: "CONFERIDO" });
    },
  ];
  const fetcher = async (url, init) => {
    const step = steps.shift();
    assert.ok(step);
    return step(new URL(url), init);
  };

  await assert.rejects(verifyJourney({ ...env, SMOKE_WRITE_ENABLED: "false" }, fetcher), /tenant dedicado/);
  assert.equal(steps.length, 7);
  await verifyJourney(env, fetcher, () => {});
  assert.equal(steps.length, 0);
});

test("Hosting exige URL Render explícita e configuração Firebase real", () => {
  const valid = { VITE_FIREBASE_PROJECT_ID: "real-project", VITE_FIREBASE_API_KEY: `AIza${"a".repeat(35)}`, VITE_API_URL: "https://api.example" };
  checkWebConfig(valid);
  assert.throws(() => checkWebConfig({ ...valid, VITE_FIREBASE_API_KEY: JSON.stringify({ apiKey: valid.VITE_FIREBASE_API_KEY }) }), /somente o valor de apiKey/);
  assert.throws(() => checkWebConfig({ ...valid, VITE_API_URL: "" }));
  assert.throws(() => checkWebConfig({ ...valid, VITE_API_URL: "http://localhost:3000" }));
  assert.throws(() => checkWebConfig({ ...valid, VITE_FIREBASE_PROJECT_ID: "demo-entregaprova" }));
});

test("retenção simula por padrão, remove só fotos vencidas e interrompe em falha de listagem", async () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  const base = `tenants/tenant-a/deliveries/${"1".repeat(44)}/proofs`;
  const expired = "a".repeat(64);
  const folders = new Map([
    ["tenants", [{ name: "tenant-a", id: null }]],
    ["tenants/tenant-a", [{ name: "deliveries", id: null }]],
    ["tenants/tenant-a/deliveries", [{ name: "1".repeat(44), id: null }]],
    [`tenants/tenant-a/deliveries/${"1".repeat(44)}`, [{ name: "proofs", id: null }]],
    [base, [
      { name: expired, id: "expired", created_at: "2026-08-01T00:00:00Z" },
      { name: "b".repeat(64), id: "recent", created_at: "2026-11-01T00:00:00Z" },
      { name: "other-file.txt", id: "other", created_at: "2026-08-01T00:00:00Z" },
    ]],
  ]);
  const removed = [];
  let fail = false;
  const client = { storage: {
    getBucket: async () => ({ data: { public: false } }),
    from: () => ({
      list: async prefix => fail ? { error: new Error("offline") } : { data: folders.get(prefix) || [] },
      remove: async paths => { removed.push(...paths); return { error: null }; },
    }),
  } };
  assert.equal((await cleanupProofs(client, "proofs", { now })).expired, 1);
  assert.equal(removed.length, 0);
  await cleanupProofs(client, "proofs", { now, apply: true });
  assert.deepEqual(removed, [`${base}/${expired}`]);
  fail = true;
  await assert.rejects(cleanupProofs(client, "proofs", { now, apply: true }), /listagem|listar/);
  assert.equal(removed.length, 1);
});
