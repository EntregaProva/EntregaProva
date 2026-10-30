import { describe, it, expect } from "vitest";
import { validarChaveNfe } from "../validacao-nfe/nfe.test.js";

const CHAVE_VALIDA = "35261000000000000191550010000123451000123450";

describe("US-01 critério 5 - chave de acesso (EP/BVA)", () => {
  it("CT-09: rejeita chave com 43 dígitos", () => {
    const chave = CHAVE_VALIDA.slice(0, 43);

    expect(validarChaveNfe(chave)).toEqual({ valida: false, motivo: "TAMANHO_INVALIDO" });
  });

  it("CT-10: aceita chave de 44 dígitos com Módulo 11 correto", () => {
    expect(validarChaveNfe(CHAVE_VALIDA)).toEqual({ valida: true });
  });

  it("CT-11: rejeita chave de 44 dígitos com DV errado", () => {
    const chave = CHAVE_VALIDA.slice(0, 43) + "1";

    expect(validarChaveNfe(chave)).toEqual({ valida: false, motivo: "DV_INVALIDO" });
  });

  it("CT-12: rejeita chave com 45 dígitos", () => {
    const chave = CHAVE_VALIDA + "7";

    expect(validarChaveNfe(chave)).toEqual({ valida: false, motivo: "TAMANHO_INVALIDO" });
  });

  it("CT-13: rejeita chave com caractere não numérico", () => {
    const chave = CHAVE_VALIDA.slice(0, 43) + "A";

    expect(validarChaveNfe(chave)).toEqual({ valida: false, motivo: "NAO_NUMERICA" });
  });
});