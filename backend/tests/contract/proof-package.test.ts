import { createHash } from "node:crypto";
import request from "supertest";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { parsePackageRequest } from "../../src/services/proof-package.service.js";
import { fixture, jpeg, key, path } from "../helpers.js";

const input = { embarcadorId: key.slice(6, 20), entregaIds: [key] };
const endpoint = "/api/v1/pacotes-comprovacao";
function prepared() {
  const f = fixture();
  f.seed();
  const object = `${path()}/proofs/hash`;
  f.objects.set(object, jpeg);
  Object.assign(f.documents.get(path())!, { status: "CONFERIDO", numeroNF: "1", valorTotal: 10,
    criadoEm: "2026-11-01T00:00:00.000Z", comprovante: { arquivoPath: object } });
  return { ...f, object };
}
async function finished(f: ReturnType<typeof prepared>, id: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await request(f.app).get(`${endpoint}/${id}`).auth("operator", { type: "bearer" });
    if (res.body.status !== "PROCESSANDO") return res.body;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Pacote não terminou");
}
const create = (f: ReturnType<typeof prepared>, body: unknown = input) =>
  request(f.app).post(endpoint).auth("operator", { type: "bearer" }).send(body as object);
const getZip = (f: ReturnType<typeof prepared>, url: string) => request(f.app).get(url).buffer(true)
  .parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on("data", chunk => chunks.push(Buffer.from(chunk)));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
  });

describe("US-05 - pacote pela API", () => {
  it("CA01/CA02: aceita 202, gera ZIP e verifica cada hash e nome de comprovante", async () => {
    const f = prepared();
    const res = await create(f);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("PROCESSANDO");
    expect(res.headers.location).toBe(`${endpoint}/${res.body.id}`);
    const job = await finished(f, res.body.id);
    expect(job.status).toBe("PRONTO");
    expect(JSON.stringify(job)).not.toMatch(/secret|arquivoPath|\/proofs\//);
    const download = await getZip(f, job.urlDownload);
    expect(download.status).toBe(200);
    expect(download.headers["cache-control"]).toBe("no-store");
    const files = unzipSync(download.body);
    expect(Object.keys(files).sort()).toEqual([`fotos/${key}.jpg`, "manifesto.json", "resumo.json"]);
    expect(Buffer.from(files[`fotos/${key}.jpg`])).toEqual(jpeg);
    const summary = JSON.parse(strFromU8(files["resumo.json"]));
    expect(summary).toMatchObject({ quantidadeEntregas: 1, valorTotal: 10 });
    const manifest = JSON.parse(strFromU8(files["manifesto.json"]));
    for (const item of manifest.arquivos) {
      expect(createHash("sha256").update(files[item.arquivo]).digest("hex")).toBe(item.sha256);
    }
    expect(JSON.stringify(f.logger.info.mock.calls)).not.toContain("signature=");
  });

  it("protege criação e consulta por token, papel e tenant", async () => {
    const f = prepared();
    expect((await request(f.app).post(endpoint).send(input)).status).toBe(401);
    expect((await request(f.app).post(endpoint).auth("driver", { type: "bearer" }).send(input)).status).toBe(403);
    const { body } = await create(f);
    await finished(f, body.id);
    f.users.operatorB = { uid: "b", tenantId: "tenant-b", role: "operator" };
    expect((await request(f.app).get(`${endpoint}/${body.id}`).auth("operatorB", { type: "bearer" })).status).toBe(404);
    expect((await request(f.app).get(`${endpoint}/${body.id}`).auth("driver", { type: "bearer" })).status).toBe(403);
    expect((await request(f.app).get(`${endpoint}/${body.id}/arquivo`)).status).toBe(403);
  });

  it("rejeita links adulterados e expirados", async () => {
    const f = prepared();
    const { body } = await create(f);
    const job = await finished(f, body.id);
    const url = new URL(job.urlDownload, "https://api.example");
    url.searchParams.set("signature", "0".repeat(64));
    expect((await request(f.app).get(url.pathname + url.search)).status).toBe(403);
    url.searchParams.set("expires", String(Date.now() - 1000));
    expect((await request(f.app).get(url.pathname + url.search)).status).toBe(403);
  });

  it.each([
    [{ status: "PENDENTE" }, "conferidas"],
    [{ criadoEm: "inválido" }, "período"],
    [{ comprovante: { arquivoPath: "tenants/tenant-b/private" } }, "indisponível"],
  ])("falha sem produzir um pacote parcial para entrega inválida %j", async (changes, message) => {
    const f = prepared();
    Object.assign(f.documents.get(path())!, changes);
    const { body } = await create(f);
    expect(await finished(f, body.id)).toMatchObject({ status: "FALHOU", urlDownload: null, erro: expect.stringContaining(message) });
  });

  it.each([
    { ...input, embarcadorId: "9".repeat(14) },
    { ...input, entregaIds: ["9".repeat(44)] },
    { ...input, inicio: "2026-11-02T00:00:00.000Z", fim: "2026-11-03T00:00:00.000Z" },
  ])("valida embarcador, existência e período no processamento %j", async body => {
    const f = prepared();
    const res = await create(f, body);
    expect((await finished(f, res.body.id)).status).toBe("FALHOU");
  });

  it("não serve arquivo expirado nem comprovante alterado depois da geração", async () => {
    const f = prepared();
    const { body } = await create(f);
    const job = await finished(f, body.id);
    f.objects.delete(f.object);
    expect((await request(f.app).get(job.urlDownload)).status).toBe(410);
    f.objects.set(f.object, Buffer.concat([jpeg, Buffer.from("alterado")]));
    expect((await request(f.app).get(job.urlDownload)).status).toBe(409);
  });

  it("propaga falha de armazenamento sem divulgar detalhes internos", async () => {
    const f = prepared();
    vi.spyOn(f.deps.proofStorage, "download").mockRejectedValueOnce(new Error("SECRET-internal"));
    const { body } = await create(f);
    const job = await finished(f, body.id);
    expect(job.status).toBe("FALHOU");
    expect(JSON.stringify(job)).not.toContain("SECRET");
  });

  it.each([Buffer.from("conteúdo inválido"), Buffer.concat([jpeg, Buffer.alloc(300_001)])])(
    "recusa conteúdo inválido ou acima do limite do comprovante", async bytes => {
      const f = prepared();
      f.objects.set(f.object, bytes);
      const { body } = await create(f);
      expect((await finished(f, body.id)).status).toBe("FALHOU");
    },
  );

  it("limita o tamanho total antes de declarar o pacote pronto", async () => {
    const f = prepared();
    const ids = Array.from({ length: 70 }, (_, i) => key.slice(0, 20) + String(i).padStart(24, "0"));
    const bytes = Buffer.alloc(300_000);
    jpeg.copy(bytes);
    for (const id of ids) {
      const object = `${path("tenant-a", id)}/proofs/hash`;
      f.objects.set(object, bytes);
      f.documents.set(path("tenant-a", id), { ...f.documents.get(path()), comprovante: { arquivoPath: object } });
    }
    const { body } = await create(f, { ...input, entregaIds: ids });
    expect(await finished(f, body.id)).toMatchObject({ status: "FALHOU", erro: expect.stringContaining("20 MiB") });
  });

  it("recupera trabalho persistido após reinício sem duplicar o processamento concorrente", async () => {
    const f = prepared();
    const id = "12345678-1234-1234-1234-123456789abc";
    f.documents.set(`tenants/tenant-a/proofPackages/${id}`, { ...input, status: "PROCESSANDO",
      criadoEm: new Date().toISOString(), secret: "synthetic", leaseUntil: Date.now() - 1000 });
    f.app = createApp(f.deps);
    const download = vi.spyOn(f.deps.proofStorage, "download");
    await Promise.all([1, 2].map(() => request(f.app).get(`${endpoint}/${id}`).auth("operator", { type: "bearer" })));
    expect((await finished(f, id)).status).toBe("PRONTO");
    expect(download).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { ...input, entregaIds: [] }, { ...input, entregaIds: [key, key] },
    { ...input, formato: "PDF" }, { ...input, inicio: "ontem" },
    { ...input, inicio: "2026-11-02T00:00:00.000Z" },
    { ...input, inicio: "2026-11-03T00:00:00.000Z", fim: "2026-11-02T00:00:00.000Z" },
  ])("recusa pedido inválido %j", body => { expect(() => parsePackageRequest(body)).toThrow(); });
});
