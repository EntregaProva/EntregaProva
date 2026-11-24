import { afterEach, describe, expect, it, vi } from "vitest";
import { formatarDataHora, novaChaveDeIdempotencia } from "./format.ts";

afterEach(() => vi.unstubAllGlobals());

describe("formatarDataHora", () => {
  it("mostra um traço para data inválida", () => {
    expect(formatarDataHora("não é data")).toBe("—");
  });

  it("formata uma data válida em pt-BR", () => {
    expect(formatarDataHora("2026-11-24T15:30:00Z")).toMatch(/24/);
  });
});

describe("novaChaveDeIdempotencia", () => {
  it("gera chaves diferentes a cada chamada", () => {
    expect(novaChaveDeIdempotencia()).not.toBe(novaChaveDeIdempotencia());
  });

  it("usa o plano B quando crypto.randomUUID não existe (celular em http)", () => {
    vi.stubGlobal("crypto", {});
    expect(novaChaveDeIdempotencia()).toMatch(/^\d+-[0-9a-f]+$/);
  });
});