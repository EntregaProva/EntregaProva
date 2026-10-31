import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { importarNfe } from "../../src/validacao-nfe/importacao.js";

const CHAVE_VALIDA = "35261000000000000191550010000123451000123450";
const NUMERO_DA_NOTA = "12345";
const XML_XXE = new URL("../../../testes/nfe-maliciosa-xxe.xml", import.meta.url);

type Resultado = ReturnType<typeof importarNfe>;
type OpcoesXml = { versao?: string; chave?: string; numero?: string };

function montarXml({ versao = "4.00", chave = CHAVE_VALIDA, numero = NUMERO_DA_NOTA }: OpcoesXml = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="${versao}">
    <ide><nNF>${numero}</nNF></ide>
    <emit><CNPJ>00000000000191</CNPJ><xNome>DISTRIBUIDORA EXEMPLO LTDA</xNome></emit>
    <dest><CNPJ>11111111000122</CNPJ><xNome>SUPERMERCADO MODELO LTDA</xNome></dest>
  </infNFe>
</NFe>`;
}

function importar(conteudo: string, nomeArquivo = "nota.xml") {
  return importarNfe({ nomeArquivo, conteudo });
}

function entregaImportada(res: Resultado) {
  if (!res.ok) {
    throw new Error(`Importação deveria ter sido aceita, mas foi recusada: ${res.codigo}`);
  }
  return res.entrega;
}

function erroDaImportacao(res: Resultado) {
  if (res.ok) {
    throw new Error("Importação deveria ter sido recusada, mas foi aceita");
  }
  return res;
}

describe("US-01 - importação de XML de NF-e", () => {
  it("CT-01: aceita arquivo com extensão .xml", () => {
    const entrega = entregaImportada(importar(montarXml(), "nota.xml"));

    expect(entrega).toBeDefined();
  });

  it("CT-02: rejeita arquivo com extensão diferente de .xml", () => {
    const erro = erroDaImportacao(importar(montarXml(), "nota.txt"));

    expect(erro.codigo).toBe("EXTENSAO_INVALIDA");
  });

  it("CT-03: aceita NF-e com versão 4.00", () => {
    const entrega = entregaImportada(importar(montarXml({ versao: "4.00" })));

    expect(entrega).toBeDefined();
  });

  it("CT-04: rejeita NF-e com versão não suportada", () => {
    const erro = erroDaImportacao(importar(montarXml({ versao: "3.10" })));

    expect(erro.codigo).toBe("VERSAO_NAO_SUPORTADA");
  });

  it("CT-05: parser extrai nNF e a chave do XML válido", () => {
    const entrega = entregaImportada(importar(montarXml()));

    expect(entrega.numero).toBe(NUMERO_DA_NOTA);
    expect(entrega.chaveAcesso).toBe(CHAVE_VALIDA);
  });

  it("CT-06: rejeita XML malformado", () => {
    const erro = erroDaImportacao(importar("<NFe><infNFe></NFe>"));

    expect(erro.codigo).toBe("XML_MALFORMADO");
  });

  it("CT-07: rejeita XML com entidade externa (XXE) usando nfe-maliciosa-xxe.xml", () => {
    const xmlMalicioso = readFileSync(XML_XXE, "utf8");

    const erro = erroDaImportacao(importar(xmlMalicioso, "nfe-maliciosa-xxe.xml"));

    expect(erro.httpStatus).toBe(400);
    expect(JSON.stringify(erro)).not.toContain("root:");
  });

  it("CT-08: entrega importada recebe o status inicial PENDENTE", () => {
    const entrega = entregaImportada(importar(montarXml()));

    expect(entrega.status).toBe("PENDENTE");
  });
});