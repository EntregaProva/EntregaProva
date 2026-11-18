import { describe, it, expect } from "vitest";
import { validateNFeKey } from "../src/utils/nfeKeyValidator";

describe("Suíte EP/BVA - Validação da Chave de Acesso (NF-e)", () => {
  // Chave canônica válida de 44 dígitos com DV correto (final 1)
  const validKey = "35231012345678000195550010000001011234567891";

  it("EP - Válida: Aceita chave numérica de 44 dígitos com DV correto", () => {
    const result = validateNFeKey(validKey);
    expect(result.isValid).toBe(true);
  });

  it("BVA - Borda Inferior: Recusa chave com 43 dígitos", () => {
    const key43 = validKey.substring(0, 43);
    const result = validateNFeKey(key43);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("44 dígitos");
  });

  it("BVA - Borda Superior: Recusa chave com 45 dígitos", () => {
    const key45 = validKey + "0";
    const result = validateNFeKey(key45);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("44 dígitos");
  });

  it("EP - Recusa chave de 44 dígitos com Dígito Verificador incorreto", () => {
    // Altera o último dígito de '1' para '2'
    const invalidDVKey = validKey.substring(0, 43) + "2";
    const result = validateNFeKey(invalidDVKey);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("Dígito verificador inválido");
  });

  it("EP - Recusa chave contendo caracteres não numéricos", () => {
    const nonNumeric = "3523101234567800019555001000000101123456789A";
    const result = validateNFeKey(nonNumeric);
    expect(result.isValid).toBe(false);
  });
});