import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fixture, jpeg, key, path, xml } from "./helpers.js";
import { MAX_XML_BYTES, parseNFeXML } from "../src/utils/xmlParser.js";
import { HttpError } from "../src/utils/httpError.js";

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;
const DOCUMENTO_PESSOAL = "DADO-QUE-NAO-DEVE-SER-SALVO";

const caminhoIdempotencia = (idem: string, tenant = "tenant-a") => `tenants/${tenant}/idempotency/${idem}`;
const KB_300 = 300 * 1024;
const fotoComBytes = (bytes: number) => Buffer.concat([jpeg, Buffer.alloc(bytes - jpeg.length)]);

let f: ReturnType<typeof fixture>;

beforeEach(() => {
  f = fixture();
});

type Envio = { idem?: string; recebedor?: string; foto?: Buffer; token?: string };

const enviarComprovante = async ({
  idem = "upload-1",
  recebedor = "RECEBEDOR SINTETICO",
  foto = jpeg,
  token = "driver",
}: Envio = {}) => {
  const res = await request(f.app)
    .post(`/api/v1/entregas/${key}/comprovantes`)
    .auth(token, { type: "bearer" })
    .set("Idempotency-Key", idem)
    .field("recebedor", recebedor)
    .field("dataHora", "2026-10-31T10:00:00-03:00")
    .field("recebedorDocumento", DOCUMENTO_PESSOAL)
    .attach("foto", foto, { filename: "foto.jpg", contentType: "image/jpeg" });
  return res;
};

const conferir = (body: object) =>
  request(f.app)
    .post(`/api/v1/entregas/${key}/conferencia`)
    .auth("operator", { type: "bearer" })
    .send(body);

function erroAoImportar(conteudo: string): HttpError {
  try {
    parseNFeXML(conteudo);
  } catch (erro) {
    return erro as HttpError;
  }
  throw new Error("A importação deveria ter sido recusada");
}

function travarSalvamento() {
  let liberar!: () => void;
  let avisarInicio!: () => void;
  const portao = new Promise<void>(resolve => { liberar = resolve; });
  const iniciou = new Promise<void>(resolve => { avisarInicio = resolve; });
  const original = f.save.getMockImplementation()!;

  f.save.mockImplementation(async (...args) => {
    avisarInicio();
    await portao;
    return original(...args);
  });

  return { iniciou, liberar };
}

function expirarLocks(idem: string) {
  f.documents.get(caminhoIdempotencia(idem))!.leaseUntil = 0;
  f.documents.get(path())!.uploadLease.leaseUntil = 0;
}

describe("US-01 - parser de XML", () => {
  it("CT-28: aceita NF-e direta e NF-e processada (nfeProc)", () => {
    expect(parseNFeXML(xml()).chave).toBe(key);
    expect(parseNFeXML(`<nfeProc>${xml()}</nfeProc>`).numero).toBe("1");
  });

  it("CT-29: aceita exatamente 1 MiB e rejeita 1 byte a mais (413)", () => {
    const noLimite = xml() + " ".repeat(MAX_XML_BYTES - Buffer.byteLength(xml()));

    expect(parseNFeXML(noLimite).chave).toBe(key);
    expect(() => parseNFeXML(noLimite + " ")).toThrowError(expect.objectContaining({ status: 413 }));
  });

  it("CT-30: conta o limite em bytes UTF-8, não em caracteres", () => {
    // "é" ocupa 2 bytes, se tiver 1 caracter já estoura
    expect(() => parseNFeXML("é".repeat(MAX_XML_BYTES / 2 + 1)))
      .toThrowError(expect.objectContaining({ status: 413 }));
  });

  it.each([
    {
      id: "CT-31.1",
      caso: "DTD com entidade externa",
      entrada: '<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + xml(),
      naoDeveAparecer: "/etc/passwd",
    },
    {
      id: "CT-31.2",
      caso: "ENTITY solta",
      entrada: '<!ENTITY xxe "secret">' + xml(),
      naoDeveAparecer: "secret",
    },
    {
      id: "CT-31.3",
      caso: "DV da chave incorreto",
      entrada: xml("4.00", key.slice(0, 43) + "2"),
      naoDeveAparecer: key.slice(0, 43) + "2",
    },
    {
      id: "CT-31.4",
      caso: "cDV divergente da chave",
      entrada: xml().replace("<cDV>1</cDV>", "<cDV>2</cDV>"),
      naoDeveAparecer: key,
    },
  ])("$id: rejeita $caso sem ecoar o conteúdo no erro", ({ entrada, naoDeveAparecer }) => {
    const erro = erroAoImportar(entrada);

    expect(erro).toBeInstanceOf(HttpError);
    expect(erro.message).not.toContain(naoDeveAparecer);
  });
});

describe("US-01 - importação pela API", () => {
  it("CT-32: importa em tenants/{tenant}/deliveries/{chave44} e bloqueia duplicata (409)", async () => {
    const importar = () =>
      request(f.app)
        .post("/api/v1/deliveries/xml")
        .auth("operator", { type: "bearer" })
        .send({ xmlContent: xml(), driverId: "driver-a" });

    expect((await importar()).status).toBe(201);
    expect([...f.documents.keys()]).toEqual([path()]);
    expect((await importar()).status).toBe(409);
  });

  it("CT-33: rejeita XML grande (413) e não grava nada", async () => {
    const res = await request(f.app)
      .post("/api/v1/entregas/xml")
      .auth("operator", { type: "bearer" })
      .send({ xmlContent: xml() + " ".repeat(MAX_XML_BYTES) });

    expect(res.status).toBe(413);
    expect(f.documents.size).toBe(0);
  });
});

describe("Infraestrutura - health e readiness", () => {
  it("CT-34: health responde 200 sem autenticação, Firestore ou Storage", async () => {
    f.read.mockRejectedValue(new Error("offline"));

    for (const url of ["/healthz", "/api/v1/health", "/api/v1/healthz"]) {
      expect((await request(f.app).get(url)).status).toBe(200);
    }

    expect(f.read).not.toHaveBeenCalled();
    expect(f.deps.auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("CT-35: readiness faz uma leitura leve e, se ela falha, responde 503 sem vazar o erro", async () => {
    expect((await request(f.app).get("/readyz")).status).toBe(200);
    expect(f.read).toHaveBeenCalledWith({ path: "_system/readiness" });

    f.read.mockRejectedValue(new Error("sensitive error"));
    const res = await request(f.app).get("/api/v1/readyz");

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("sensitive");
  });

  it("CT-36: readiness responde 503 quando a leitura trava", async () => {
    f.read.mockImplementation(() => new Promise(() => undefined));

    expect((await request(f.app).get("/readyz")).status).toBe(503);
  }, 4000);
});

describe("US-02 - envio de comprovante", () => {
  beforeEach(() => {
    f.seed();
  });

  it("CT-17.1: aceita foto de exatamente 300 KB", async () => {
    const res = await enviarComprovante({ idem: "limite-300kb", foto: fotoComBytes(KB_300) });

    expect(res.status).toBe(200);
  });

  // BUG-003: o multer aceita até 5 MB; o Caderno define 300 KB
  it.fails("CT-17.2: recusa foto com 1 byte acima de 300 KB (413)", async () => {
    const res = await enviarComprovante({ idem: "acima-300kb", foto: fotoComBytes(KB_300 + 1) });

    expect(res.status).toBe(413);
    expect(f.save).not.toHaveBeenCalled();
  });

  it("CT-37.1: não salva o documento pessoal do recebedor", async () => {
    expect((await enviarComprovante()).status).toBe(200);

    const salvo = JSON.stringify([...f.documents.values()]);
    expect(salvo).not.toContain(DOCUMENTO_PESSOAL);
    expect(salvo).not.toContain("recebedorDocumento");
  });

  it("CT-37.2: devolve URL assinada (v4, somente leitura) válida por 15 minutos", async () => {
    const res = await enviarComprovante();

    expect(res.body.comprovante.arquivoUrl).toContain("https://");

    const opcoes = f.sign.mock.calls[0][1] as { expires: number; action: string; version: string };
    const restante = opcoes.expires - Date.now();

    expect(opcoes).toMatchObject({ action: "read", version: "v4" });
    expect(restante).toBeGreaterThan(QUINZE_MINUTOS_MS - 5_000);
    expect(restante).toBeLessThanOrEqual(QUINZE_MINUTOS_MS);
  });

  it("CT-37.3: grava o arquivo apenas se ele ainda não existir", async () => {
    await enviarComprovante();

    expect(f.save.mock.calls[0][2]).toMatchObject({ preconditionOpts: { ifGenerationMatch: 0 } });
  });

  it("CT-37.4: repetir o mesmo envio devolve 200 sem novo upload", async () => {
    expect((await enviarComprovante()).status).toBe(200);
    expect(f.documents.get(caminhoIdempotencia("upload-1"))?.state).toBe("completed");

    expect((await enviarComprovante()).status).toBe(200);

    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.sign).toHaveBeenCalledTimes(2); // a URL é assinada novamente toda vez
  });

  it("CT-38: a mesma chave de idempotência com conteúdo diferente é rejeitada (409)", async () => {
    expect((await enviarComprovante()).status).toBe(200);
    expect((await enviarComprovante({ recebedor: "OUTRO NOME" })).status).toBe(409);
    expect(f.save).toHaveBeenCalledTimes(1);
  });

  it("CT-39: a chave de idempotência é isolada por tenant", async () => {
    f.seed("tenant-b", "driver-b");

    expect((await enviarComprovante()).status).toBe(200);
    expect((await enviarComprovante({ token: "otherTenant" })).status).toBe(200);

    expect(f.documents.has(caminhoIdempotencia("upload-1", "tenant-a"))).toBe(true);
    expect(f.documents.has(caminhoIdempotencia("upload-1", "tenant-b"))).toBe(true);
  });

  it("CT-40.1: exige a chave de idempotência (400)", async () => {
    expect((await enviarComprovante({ idem: "" })).status).toBe(400);
    expect(f.save).not.toHaveBeenCalled();
  });

  it("CT-40.2: rejeita arquivo que não é imagem (415)", async () => {
    expect((await enviarComprovante({ foto: Buffer.from("texto") })).status).toBe(415);
    expect(f.save).not.toHaveBeenCalled();
  });

  it("CT-41: segundo envio para a mesma entrega durante um upload em andamento recebe 409", async () => {
    const { iniciou, liberar } = travarSalvamento();

    const primeiro = enviarComprovante();
    await iniciou;

    expect((await enviarComprovante()).status).toBe(409);
    expect((await enviarComprovante({ idem: "outra-chave" })).status).toBe(409);

    liberar();
    expect((await primeiro).status).toBe(200);
    expect(f.save).toHaveBeenCalledTimes(1);
  });

  it("CT-42: se o upload deu certo mas a resposta se perdeu, a nova tentativa conclui sem sobrescrever", async () => {
    const original = f.save.getMockImplementation()!;
    f.save.mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new Error("resposta perdida");
    });

    expect((await enviarComprovante()).status).toBe(500);
    expect(f.documents.get(path())?.status).toBe("PENDENTE");

    expirarLocks("upload-1");

    expect((await enviarComprovante()).status).toBe(200);
    expect(f.objects.size).toBe(1);
  });

  it("CT-43: se a assinatura da URL falha, a nova tentativa devolve o resultado sem reenviar o arquivo", async () => {
    f.sign.mockRejectedValueOnce(new Error("sign failed"));

    expect((await enviarComprovante()).status).toBe(500);
    expect((await enviarComprovante()).status).toBe(200);
    expect(f.save).toHaveBeenCalledTimes(1);
  });
});

describe("US-03 - conferência do comprovante", () => {
  beforeEach(() => {
    f.seed();
  });

  it("CT-44.1: não permite conferir uma entrega sem comprovante (409)", async () => {
    expect((await conferir({ decisao: "APROVAR" })).status).toBe(409);
  });

  it("CT-44.2: rejeita decisão em formato inválido (400)", async () => {
    await enviarComprovante();

    expect((await conferir({ aprovado: "false" })).status).toBe(400);
  });

  it("CT-44.3: exige motivo ao rejeitar (400)", async () => {
    await enviarComprovante();

    expect((await conferir({ decisao: "REJEITAR" })).status).toBe(400);
  });

  it("CT-44.4: após rejeitar, permite reenviar o comprovante e aprovar", async () => {
    await enviarComprovante();
    expect((await conferir({ decisao: "REJEITAR", motivo: "Imagem ilegível" })).status).toBe(200);

    expect((await enviarComprovante({ idem: "nova-tentativa" })).status).toBe(200);

    expect((await conferir({ decisao: "APROVAR" })).body.status).toBe("CONFERIDO");
  });
});

describe("Segurança e compatibilidade da API", () => {
  describe("quando o upload falha com um erro interno", () => {
    beforeEach(() => {
      f.seed();
      f.save.mockRejectedValueOnce(new Error("CPF SEGREDO TOKEN"));
    });

    it("CT-45.1: responde 500 genérico, sem detalhes internos", async () => {
      const res = await enviarComprovante();

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Erro interno" });
    });

    it("CT-45.2: os logs registram só campos seguros", async () => {
      await enviarComprovante();

      const logs = JSON.stringify([f.logger.info.mock.calls, f.logger.error.mock.calls]);

      expect(logs).not.toContain("SEGREDO");
      expect(logs).not.toContain("RECEBEDOR");
      expect(logs).not.toContain(key);
      expect(logs).not.toContain("signed=secret");
      expect(f.logger.info).toHaveBeenCalledWith(expect.objectContaining({
        event: "http_request",
        route: "/entregas/:id/comprovantes",
        status: 500,
      }));
    });
  });

  it("CT-46: a rota antiga (/deliveries/:id/proof e /check) continua funcionando", async () => {
    f.seed();

    const envio = await request(f.app)
      .post(`/api/v1/deliveries/${key}/proof`)
      .auth("driver", { type: "bearer" })
      .set("Idempotency-Key", "legacy")
      .field("recebedorNome", "NOME")
      .field("dataHoraEntrega", "2026-10-31T10:00:00Z")
      .attach("file", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

    const conferencia = await request(f.app)
      .patch(`/api/v1/deliveries/${key}/check`)
      .auth("operator", { type: "bearer" })
      .send({ aprovado: true });

    expect(envio.status).toBe(200);
    expect(conferencia.status).toBe(200);
  });
});

describe("US-06 - listagem de entregas", () => {
  it.todo("CT-14: operador lista as entregas do tenant, paginadas por cursor");
  it.todo("CT-15: motorista vê só as entregas atribuídas a ele");
  it.todo("CT-16: sem entregas, devolve 200 com lista vazia");
});

describe("Segurança - CORS", () => {
  // BUG-004: o cors() está sem lista de origens e libera qualquer uma.
  it.fails("CT-18: não libera origem fora da lista", async () => {
    const res = await request(f.app)
      .get("/healthz")
      .set("Origin", "https://origem-nao-autorizada.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.todo("CT-19: libera as origens do Firebase Hosting e dos emuladores");
});