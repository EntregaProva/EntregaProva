import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { fixture, key, path, xml } from "../helpers.js";
import { parseNFeXML } from "../../src/utils/xmlParser.js";
import { HttpError } from "../../src/utils/httpError.js";

const XML_XXE = resolve(__dirname, "../../../testes/nfe-maliciosa-xxe.xml");

function erroAoImportar(conteudo: string): HttpError {
  try {
    parseNFeXML(conteudo);
  } catch (erro) {
    return erro as HttpError;
  }
  throw new Error("A importação deveria ter sido recusada");
}

async function importarPelaApi(conteudo: string) {
  const f = fixture();
  const res = await request(f.app)
    .post("/api/v1/entregas/xml")
    .auth("operator", { type: "bearer" })
    .send({ xmlContent: conteudo });
  return { f, res };
}

describe("US-01 - importação de XML de NF-e", () => {
  it("CT-01: aceita XML válido enviado pela API (201)", async () => {
    const { res } = await importarPelaApi(xml());

    expect(res.status).toBe(201);
  });

  it.todo("CT-02: rejeita arquivo com extensão diferente de .xml (o backend só recebe o conteúdo, sem checar extensão)");

  it("CT-03: aceita NF-e com versão 4.00", () => {
    expect(parseNFeXML(xml("4.00")).chave).toBe(key);
  });

  it("CT-04: rejeita NF-e com versão não suportada", () => {
    expect(erroAoImportar(xml("3.10")).status).toBe(422);
  });

  it("CT-05: parser extrai nNF e a chave do XML válido", () => {
    const nota = parseNFeXML(xml());

    expect(nota.numero).toBe("1");
    expect(nota.chave).toBe(key);
  });

  it("CT-06: rejeita XML malformado", () => {
    expect(erroAoImportar(xml().replace("</ide>", "")).status).toBe(422);
  });

  it("CT-07: rejeita XML com entidade externa (XXE) com HTTP 400", () => {
    const erro = erroAoImportar(readFileSync(XML_XXE, "utf8"));

    expect(erro.status).toBe(400);
    expect(erro.message).not.toContain("root:");
  });

  it("CT-08: entrega importada recebe o status inicial PENDENTE", async () => {
    const { f, res } = await importarPelaApi(xml());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDENTE");
    expect(f.documents.get(path())?.status).toBe("PENDENTE");
  });
});