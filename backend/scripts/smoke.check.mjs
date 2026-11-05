import { test } from "node:test";
import assert from "node:assert/strict";
import { smoke } from "./smoke.mjs";
import { stableRevision } from "../../infra/cp3/verify-hosting-api.mjs";

test("smoke exige JSON da API e SHA da revisão candidata", async () => {
  const valid = async url => Response.json(url.endsWith("healthz")
    ? { status: "ok", service: "entregaprova-api", revision: "sha-esperado" } : { status: "ready" });
  assert.equal((await smoke("https://candidate.example", "sha-esperado", valid)).length, 2);
  await assert.rejects(smoke("https://candidate.example", "sha-errado", valid), /outra revisão/);
  await assert.rejects(smoke("https://candidate.example", undefined, async () => new Response("<html>SPA</html>")), /Content-Type/);
  await assert.rejects(smoke("https://candidate.example", undefined, async () => Response.json({ status: "unavailable" }, { status: 503 })), /503/);
});

test("preview não fixa revisão candidata ainda sem tráfego", () => {
  const status = { latestReadyRevisionName: "api-good", traffic: [{ revisionName: "api-good", percent: 100 }] };
  assert.equal(stableRevision({ status }), "api-good");
  assert.throws(() => stableRevision({ status: { ...status, latestReadyRevisionName: "api-candidate" } }), /candidata/);
  assert.throws(() => stableRevision({ status }, "api-old"), /mudou/);
});
