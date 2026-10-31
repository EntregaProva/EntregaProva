import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fixture, jpeg, key, path, xml } from "./helpers.js";
import { MAX_XML_BYTES, parseNFeXML } from "../src/utils/xmlParser.js";
import { HttpError } from "../src/utils/httpError.js";

describe("Validação XML em quatro estágios", () => {
  it("aceita NF-e direta e processada", () => {
    expect(parseNFeXML(xml()).chave).toBe(key);
    expect(parseNFeXML(`<nfeProc>${xml()}</nfeProc>`).numero).toBe("1");
  });
  it("aceita exatamente 1 MiB e rejeita um byte acima", () => {
    const exact = xml() + " ".repeat(MAX_XML_BYTES - Buffer.byteLength(xml()));
    expect(parseNFeXML(exact).chave).toBe(key);
    expect(() => parseNFeXML(exact + " ")).toThrowError(expect.objectContaining({ status: 413 }));
  });
  it("mede bytes UTF-8", () => {
    expect(() => parseNFeXML("é".repeat(MAX_XML_BYTES / 2 + 1))).toThrowError(expect.objectContaining({ status: 413 }));
  });
  it.each([
    '<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + xml(),
    '<!ENTITY xxe "secret">' + xml(),
    xml("3.10"), xml().replace("</ide>", ""), xml("4.00", key.slice(0, 43) + "2"),
    xml().replace("<cDV>1</cDV>", "<cDV>2</cDV>"),
  ])("rejeita entrada inválida sem ecoar seu conteúdo", value => {
    expect(() => parseNFeXML(value)).toThrow(HttpError);
  });
});

describe("API CP2 e CP3", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => { f = fixture(); });
  const upload = (idem = "upload-1", name = "RECEBEDOR SINTETICO", bytes = jpeg, token = "driver") =>
    request(f.app).post(`/api/v1/entregas/${key}/comprovantes`)
      .auth(token, { type: "bearer" }).set("Idempotency-Key", idem)
      .field("recebedor", name).field("dataHora", "2026-10-31T10:00:00-03:00")
      .field("recebedorDocumento", "DADO-QUE-NAO-DEVE-SER-SALVO")
      .attach("foto", bytes, { filename: "foto.jpg", contentType: "image/jpeg" });

  it("importa em tenants/{tenant}/deliveries/{chave44} e impede duplicação", async () => {
    const send = () => request(f.app).post("/api/v1/deliveries/xml")
      .auth("operator", { type: "bearer" }).send({ xmlContent: xml(), driverId: "driver-a" });
    expect((await send()).status).toBe(201);
    expect([...f.documents.keys()]).toEqual([path()]);
    expect((await send()).status).toBe(409);
  });
  it("rejeita XML grande via HTTP", async () => {
    const res = await request(f.app).post("/api/v1/entregas/xml").auth("operator", { type: "bearer" })
      .send({ xmlContent: xml() + " ".repeat(MAX_XML_BYTES) });
    expect(res.status).toBe(413);
    expect(f.documents.size).toBe(0);
  });
  it("health não usa autenticação, Firestore ou Storage", async () => {
    f.read.mockRejectedValue(new Error("offline"));
    for (const url of ["/healthz", "/api/v1/health", "/api/v1/healthz"]) {
      expect((await request(f.app).get(url)).status).toBe(200);
    }
    expect(f.read).not.toHaveBeenCalled();
    expect(f.deps.auth.verifyIdToken).not.toHaveBeenCalled();
  });
  it("readiness realiza leitura leve e detecta falha", async () => {
    expect((await request(f.app).get("/readyz")).status).toBe(200);
    expect(f.read).toHaveBeenCalledWith({ path: "_system/readiness" });
    f.read.mockRejectedValue(new Error("sensitive error"));
    const res = await request(f.app).get("/api/v1/readyz");
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("sensitive");
  });
  it("readiness termina quando a leitura não responde", async () => {
    f.read.mockImplementation(() => new Promise(() => undefined));
    expect((await request(f.app).get("/readyz")).status).toBe(503);
  }, 4000);
  it("não salva documento, retorna URL de 15 min e repete sem novo upload", async () => {
    f.seed();
    const first = await upload();
    expect(first.status).toBe(200);
    expect(first.body.comprovante.arquivoUrl).toContain("https://");
    expect(JSON.stringify([...f.documents.values()])).not.toContain("DADO-QUE");
    expect(JSON.stringify([...f.documents.values()])).not.toContain("recebedorDocumento");
    expect(f.documents.get("tenants/tenant-a/idempotency/upload-1")?.state).toBe("completed");
    const options = f.sign.mock.calls[0][1] as { expires: number; action: string; version: string };
    expect(options.action).toBe("read");
    expect(options.version).toBe("v4");
    expect(options.expires - Date.now()).toBeGreaterThan(895_000);
    expect(options.expires - Date.now()).toBeLessThanOrEqual(900_000);
    expect((await upload()).status).toBe(200);
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.sign).toHaveBeenCalledTimes(2);
    expect(f.save.mock.calls[0][2]).toMatchObject({ preconditionOpts: { ifGenerationMatch: 0 } });
  });
  it("rejeita a mesma chave com conteúdo diferente", async () => {
    f.seed();
    expect((await upload()).status).toBe(200);
    expect((await upload("upload-1", "OUTRO NOME")).status).toBe(409);
    expect(f.save).toHaveBeenCalledTimes(1);
  });
  it("isola a chave de idempotência por tenant", async () => {
    f.seed(); f.seed("tenant-b", "driver-b");
    expect((await upload()).status).toBe(200);
    expect((await upload("upload-1", "RECEBEDOR SINTETICO", jpeg, "otherTenant")).status).toBe(200);
    expect(f.documents.has("tenants/tenant-b/idempotency/upload-1")).toBe(true);
  });
  it("exige chave e tipo de arquivo compatível", async () => {
    f.seed();
    expect((await upload("")).status).toBe(400);
    expect((await upload("key", "NOME", Buffer.from("texto"))).status).toBe(415);
    expect(f.save).not.toHaveBeenCalled();
  });
  it("serializa uploads concorrentes para a mesma entrega", async () => {
    f.seed();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const original = f.save.getMockImplementation()!;
    f.save.mockImplementation(async (...args) => { entered(); await gate; return original(...args); });
    const first = upload().then(res => res);
    await started;
    expect((await upload()).status).toBe(409);
    expect((await upload("outra-chave")).status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect(f.save).toHaveBeenCalledTimes(1);
  });
  it("recupera falha após upload sem sobrescrever o objeto", async () => {
    f.seed();
    const original = f.save.getMockImplementation()!;
    f.save.mockImplementationOnce(async (...args) => {
      await original(...args); throw new Error("resposta perdida");
    });
    expect((await upload()).status).toBe(500);
    expect(f.documents.get(path())?.status).toBe("PENDENTE");
    const pending = f.documents.get("tenants/tenant-a/idempotency/upload-1")!;
    pending.leaseUntil = 0;
    f.documents.get(path())!.uploadLease.leaseUntil = 0;
    expect((await upload()).status).toBe(200);
    expect(f.objects.size).toBe(1);
  });
  it("repete resultado após falha na assinatura sem reenviar arquivo", async () => {
    f.seed();
    f.sign.mockRejectedValueOnce(new Error("sign failed"));
    expect((await upload()).status).toBe(500);
    expect((await upload()).status).toBe(200);
    expect(f.save).toHaveBeenCalledTimes(1);
  });
  it("valida decisão, motivo e transições de conferência", async () => {
    f.seed();
    const check = (body: object) => request(f.app).post(`/api/v1/entregas/${key}/conferencia`)
      .auth("operator", { type: "bearer" }).send(body);
    expect((await check({ decisao: "APROVAR" })).status).toBe(409);
    expect((await upload()).status).toBe(200);
    expect((await check({ aprovado: "false" })).status).toBe(400);
    expect((await check({ decisao: "REJEITAR" })).status).toBe(400);
    expect((await check({ decisao: "REJEITAR", motivo: "Imagem ilegível" })).status).toBe(200);
    expect((await upload("nova-tentativa")).status).toBe(200);
    expect((await check({ decisao: "APROVAR" })).body.status).toBe("CONFERIDO");
  });
  it("logs usam campos seguros e erros não expõem detalhes internos", async () => {
    f.seed();
    f.save.mockRejectedValueOnce(new Error("CPF SEGREDO TOKEN"));
    const res = await upload();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno" });
    const logs = JSON.stringify([f.logger.info.mock.calls, f.logger.error.mock.calls]);
    expect(logs).not.toContain("SEGREDO");
    expect(logs).not.toContain("RECEBEDOR");
    expect(logs).not.toContain(key);
    expect(logs).not.toContain("signed=secret");
    expect(f.logger.info).toHaveBeenCalledWith(expect.objectContaining({
      event: "http_request", route: "/entregas/:id/comprovantes", status: 500,
    }));
  });
  it("compatibilidade da rota antiga para envio e conferência", async () => {
    f.seed();
    const res = await request(f.app).post(`/api/v1/deliveries/${key}/proof`)
      .auth("driver", { type: "bearer" }).set("Idempotency-Key", "legacy")
      .field("recebedorNome", "NOME").field("dataHoraEntrega", "2026-10-31T10:00:00Z")
      .attach("file", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect((await request(f.app).patch(`/api/v1/deliveries/${key}/check`)
      .auth("operator", { type: "bearer" }).send({ aprovado: true })).status).toBe(200);
  });
});
