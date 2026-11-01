import { describe, it, expect } from "vitest";
import { validateNFeKey } from "../../src/utils/nfeKeyValidator.js";

const CHAVE_VALIDA = "35231012345678000195550010000001011234567891";

describe("US-01 critério 5 - chave de acesso (EP/BVA)", () => {
  it("CT-09: rejeita chave com 43 dígitos", () => {
    const { isValid, reason } = validateNFeKey(CHAVE_VALIDA.slice(0, 43));

    expect(isValid).toBe(false);
    expect(reason).toContain("44 dígitos");
  });

  it("CT-10: aceita chave de 44 dígitos com DV correto", () => {
    expect(validateNFeKey(CHAVE_VALIDA).isValid).toBe(true);
  });

  it("CT-11: rejeita chave de 44 dígitos com DV errado", () => {
    const { isValid, reason } = validateNFeKey(CHAVE_VALIDA.slice(0, 43) + "2");

    expect(isValid).toBe(false);
    expect(reason).toBe("Dígito verificador inválido");
  });

  it("CT-12: rejeita chave com 45 dígitos", () => {
    const { isValid, reason } = validateNFeKey(CHAVE_VALIDA + "7");

    expect(isValid).toBe(false);
    expect(reason).toContain("44 dígitos");
  });

  it("CT-13: rejeita chave com caractere não numérico", () => {
    const { isValid, reason } = validateNFeKey(CHAVE_VALIDA.slice(0, 43) + "A");

    expect(isValid).toBe(false);
    expect(reason).toContain("numéricos");
  });
});
