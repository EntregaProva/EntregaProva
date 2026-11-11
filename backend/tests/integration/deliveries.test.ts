import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { emulatorsReady, emulatorFixture } from "./firebase.fixture.js";
import { jpeg, key, xml } from "../helpers.js";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

if (process.env.CI && !emulatorsReady) throw new Error("CI precisa exercitar Auth, Firestore e Storage emulados");

describe.skipIf(!emulatorsReady)("Integração real Auth + Firestore + Storage emulados", () => {
  let f: Awaited<ReturnType<typeof emulatorFixture>>;
  beforeAll(async () => { f = await emulatorFixture(); }, 60_000);
  beforeEach(async () => { await f.clear(); }, 30_000);
  afterAll(async () => { if (f) await f.dispose(); }, 30_000);
  const importNote = () => request(f.app).post("/api/v1/entregas/xml").auth(f.tokens.operator, { type: "bearer" })
    .send({ xmlContent: xml(), driverId: f.driverId });
  const proof = () => request(f.app).post(`/api/v1/entregas/${key}/comprovantes`).auth(f.tokens.driver, { type: "bearer" })
    .set("Idempotency-Key", "integration-proof").field("recebedor", "RECEBEDOR SINTETICO")
    .field("dataHora", "2026-11-05T10:00:00-03:00").attach("foto", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

  it("US-05: importa, comprova, confere e baixa pacote com manifesto usando os três emuladores", async () => {
    expect((await importNote()).status).toBe(201);
    expect((await proof()).status).toBe(200);
    expect((await request(f.app).post(`/api/v1/entregas/${key}/conferencia`)
      .auth(f.tokens.operator, { type: "bearer" }).send({ decisao: "APROVAR" })).status).toBe(200);
    const created = await request(f.app).post("/api/v1/pacotes-comprovacao")
      .auth(f.tokens.financeiro, { type: "bearer" }).send({ embarcadorId: key.slice(6, 20), entregaIds: [key] });
    expect(created.status).toBe(202);
    const url = created.headers.location;
    let job;
    for (let attempt = 0; attempt < 100; attempt++) {
      job = await request(f.app).get(url).auth(f.tokens.financeiro, { type: "bearer" });
      if (job.body.status !== "PROCESSANDO") break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(job?.body.status).toBe("PRONTO");
    expect((await request(f.app).get(url).auth(f.tokens.otherTenant, { type: "bearer" })).status).toBe(404);
    expect((await request(f.app).get(url).auth(f.tokens.driver, { type: "bearer" })).status).toBe(403);
    const download = await request(f.app).get(job!.body.urlDownload).buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
    expect(download.status).toBe(200);
    const files = unzipSync(download.body);
    expect(Buffer.from(files[`fotos/${key}.jpg`])).toEqual(jpeg);
    const manifest = JSON.parse(strFromU8(files["manifesto.json"]));
    expect(manifest.arquivos[1].sha256).toBe(createHash("sha256").update(jpeg).digest("hex"));
  }, 30_000);

  it("verifica ID token do Auth e persiste importação/emitente no Firestore", async () => {
    expect((await importNote()).status).toBe(201);
    const snap = await f.db.doc(`tenants/${f.tenant}/deliveries/${key}`).get();
    expect(snap.data()).toMatchObject({ emitente: "EMITENTE SINTETICO", driverId: f.driverId, status: "PENDENTE" });
    expect((await importNote()).status).toBe(409);
    expect((await request(f.app).get("/api/v1/entregas").auth("invalid-token", { type: "bearer" })).status).toBe(401);
    const parts = f.tokens.driver.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.iat = Math.floor(Date.now() / 1000) - 7200;
    payload.exp = payload.iat + 3600;
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect((await request(f.app).get("/api/v1/entregas").auth(parts.join("."), { type: "bearer" })).status).toBe(401);
  });

  it("CT-15: lista somente o tenant e o motorista verificados", async () => {
    expect((await importNote()).status).toBe(201);
    for (const role of ["operator", "driver"]) {
      const res = await request(f.app).get("/api/v1/entregas").auth(f.tokens[role], { type: "bearer" });
      expect(res.status).toBe(200);
      expect(res.body.itens.map((item: { id: string }) => item.id)).toEqual([key]);
    }
    for (const role of ["otherDriver", "otherTenant"]) {
      const res = await request(f.app).get("/api/v1/entregas").auth(f.tokens[role], { type: "bearer" });
      expect(res.body.itens).toEqual([]);
    }
    expect((await request(f.app).get(`/api/v1/entregas/${key}`).auth(f.tokens.otherDriver, { type: "bearer" })).status).toBe(403);
    expect((await request(f.app).get(`/api/v1/entregas/${key}`).auth(f.tokens.otherTenant, { type: "bearer" })).status).toBe(404);
    expect((await request(f.app).post(`/api/v1/entregas/${key}/comprovantes`).auth(f.tokens.otherDriver, { type: "bearer" })).status).toBe(403);
    expect((await request(f.app).post(`/api/v1/entregas/${key}/conferencia`).auth(f.tokens.otherTenant, { type: "bearer" }).send({ decisao: "APROVAR" })).status).toBe(404);
    expect((await request(f.app).get("/api/v1/entregas?driverId=outro").auth(f.tokens.driver, { type: "bearer" })).status).toBe(400);
  });

  it("CT-14: operador pagina com cursor e combina filtros no Firestore", async () => {
    const ids = [1, 2, 3].map(n => String(n).padStart(44, "0"));
    for (const id of ids) await f.db.doc(`tenants/${f.tenant}/deliveries/${id}`).set({ driverId: f.driverId, status: "COMPROVADO" });
    const get = (query: string) => request(f.app).get(`/api/v1/entregas?status=COMPROVADO&limit=2${query}`).auth(f.tokens.operator, { type: "bearer" });
    const first = await get("");
    expect(first.status).toBe(200);
    expect(first.body.itens.map((item: { id: string }) => item.id)).toEqual(ids.slice(0, 2));
    const second = await get(`&cursor=${first.body.proximoCursor}`);
    expect(second.status).toBe(200);
    expect(second.body.itens.map((item: { id: string }) => item.id)).toEqual(ids.slice(2));
    expect(second.body.proximoCursor).toBeNull();
    expect((await request(f.app).get("/api/v1/entregas?limit=0").auth(f.tokens.driver, { type: "bearer" })).status).toBe(400);
  });

  it("salva bytes reais e confere/rejeita/reenvia; somente a assinatura é substituída", async () => {
    expect((await importNote()).status).toBe(201);
    expect((await proof()).status).toBe(200);
    expect((await proof()).status).toBe(200);
    const [files] = await f.storage.bucket().getFiles({ prefix: `tenants/${f.tenant}/deliveries/${key}/` });
    expect(files).toHaveLength(1);
    expect((await files[0].download())[0]).toEqual(jpeg);
    const check = (body: object) => request(f.app).post(`/api/v1/entregas/${key}/conferencia`).auth(f.tokens.operator, { type: "bearer" }).send(body);
    expect((await check({ decisao: "REJEITAR" })).status).toBe(400);
    expect((await check({ decisao: "REJEITAR", motivo: "Imagem ilegível" })).body.status).toBe("REJEITADO");
    const reupload = await request(f.app).post(`/api/v1/entregas/${key}/comprovantes`).auth(f.tokens.driver, { type: "bearer" })
      .set("Idempotency-Key", "integration-proof-2").field("recebedor", "NOVO NOME SINTETICO")
      .field("dataHora", "2026-11-05T11:00:00-03:00").attach("foto", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(reupload.status).toBe(200);
    expect((await check({ decisao: "APROVAR" })).body.status).toBe("CONFERIDO");
    const detail = await request(f.app).get(`/api/v1/entregas/${key}`).auth(f.tokens.operator, { type: "bearer" });
    expect(detail.body.status).toBe("CONFERIDO");
    expect(detail.body.comprovante.arquivoDisponivel).toBe(true);
    expect(JSON.stringify(detail.body)).not.toContain("arquivoPath");
  }, 30_000);
});
