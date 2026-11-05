import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { fixture, jpeg, key, path, xml } from "./helpers.js";
import { MAX_PROOF_BYTES } from "../src/config/proof.js";
import { hasValidProofSignature } from "../src/utils/proofFile.js";
import { readFirebaseConfig } from "../src/config/runtime.js";
import { createCorsOptions } from "../src/config/cors.js";

describe("CP3: operação, privacidade e comprovantes", () => {
  const upload = (f: ReturnType<typeof fixture>, bytes = jpeg, idem = "cp3-proof") =>
    request(f.app).post(`/api/v1/entregas/${key}/comprovantes`).auth("driver", { type: "bearer" })
      .set("Idempotency-Key", idem).field("recebedor", "NOME SINTETICO")
      .field("dataHora", "2026-11-05T10:00:00-03:00")
      .attach("foto", bytes, { filename: "foto.jpg", contentType: "image/jpeg" });

  it("log final usa tenant verificado, requestId, gravidade e modelo da rota", async () => {
    const f = fixture(); f.seed();
    const res = await request(f.app).get(`/api/v1/entregas/${key}`).auth("driver", { type: "bearer" }).set("x-tenant-id", "tenant-falso");
    expect(res.status).toBe(200);
    expect(f.logger.info).toHaveBeenCalledWith(expect.objectContaining({
      severity: "INFO", tenantId: "tenant-a", requestId: res.headers["x-request-id"],
      route: "/entregas/:id", status: 200, durationMs: expect.any(Number),
    }));
    expect(JSON.stringify(f.logger.info.mock.calls)).not.toContain(key);
    await request(f.app).get(`/api/v1/entregas/${key}`).set("x-tenant-id", "tenant-falso");
    expect(f.logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: null, status: 401, severity: "WARNING" }));
  });

  it("aceita preflight local e recusa origem desconhecida sem 500", async () => {
    const f = fixture();
    const allowed = await request(f.app).options("/api/v1/entregas").set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST").set("Access-Control-Request-Headers", "authorization,idempotency-key");
    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const blocked = await request(f.app).get("/healthz").set("Origin", "https://origem-nao-autorizada.example");
    expect(blocked.status).toBe(403);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("aceita exatamente 300 KB e recusa um byte acima sem salvar", async () => {
    const f = fixture(); f.seed();
    const bytes = Buffer.alloc(MAX_PROOF_BYTES); jpeg.copy(bytes);
    expect((await upload(f, bytes)).status).toBe(200);
    const other = fixture(); other.seed();
    expect((await upload(other, Buffer.concat([bytes, Buffer.from([0])]))).status).toBe(413);
    expect(other.objects.size).toBe(0);
    expect(other.documents.get(path())?.status).toBe("PENDENTE");
  });

  it("preview CORS só é permitido para canais PR do site explicitamente configurado", () => {
    const origin = createCorsOptions([], "site-do-time").origin;
    if (typeof origin !== "function") throw new Error("Política de origem ausente");
    const allow = vi.fn();
    origin("https://site-do-time--pr-12-abc123.web.app", allow);
    expect(allow).toHaveBeenCalledWith(null, true);
    const deny = vi.fn();
    origin("https://outro-site--pr-12-abc123.web.app", deny);
    expect(deny.mock.calls[0][0]).toMatchObject({ status: 403 });
    expect(() => createCorsOptions([], "site.*")).toThrow();
  });

  it("valida WebP explicitamente e não trata qualquer tipo como PDF", () => {
    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    expect(hasValidProofSignature("image/webp", webp)).toBe(true);
    expect(hasValidProofSignature("image/webp", Buffer.from("%PDF-"))).toBe(false);
    expect(hasValidProofSignature("text/plain", Buffer.from("%PDF-"))).toBe(false);
  });

  it("arquivo removido por lifecycle não causa 500 nem ressurge num retry", async () => {
    const f = fixture(); f.seed();
    expect((await upload(f)).status).toBe(200);
    f.objects.clear();
    const detail = await request(f.app).get(`/api/v1/entregas/${key}`).auth("operator", { type: "bearer" });
    expect(detail.status).toBe(200);
    expect(detail.body.comprovante).toMatchObject({ arquivoDisponivel: false, arquivoUrl: null, expiraEm: null });
    expect(JSON.stringify(detail.body)).not.toContain("arquivoPath");
    expect((await upload(f)).status).toBe(410);
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.documents.get(path())?.status).toBe("COMPROVADO");
  });

  it("XXE devolve 400 sem gravação e sem conteúdo local", async () => {
    const f = fixture();
    const res = await request(f.app).post("/api/v1/entregas/xml").auth("operator", { type: "bearer" })
      .send({ xmlContent: '<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + xml() });
    expect(JSON.stringify(res.body)).not.toContain("root:");
    expect(res.status).toBe(400);
    expect(f.documents.size).toBe(0);
  });
});

describe("CP3: configuração de identidade", () => {
  it("configura runtime sem JSON e sem pressupor domínio do bucket", () => {
    expect(readFirebaseConfig({ NODE_ENV: "production", GCP_PROJECT_ID: "projeto-real", STORAGE_BUCKET: "bucket-configurado" }))
      .toEqual({ projectId: "projeto-real", storageBucket: "bucket-configurado" });
  });
  it("recusa emuladores, chave estática ou configuração incompleta em produção", () => {
    const valid = { NODE_ENV: "production", GCP_PROJECT_ID: "projeto-real", STORAGE_BUCKET: "bucket-configurado" };
    expect(() => readFirebaseConfig({ ...valid, FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" })).toThrow();
    expect(() => readFirebaseConfig({ ...valid, FIREBASE_SERVICE_ACCOUNT_JSON: "valor-sintetico" })).toThrow();
    expect(() => readFirebaseConfig({ NODE_ENV: "production" })).toThrow();
  });
});
