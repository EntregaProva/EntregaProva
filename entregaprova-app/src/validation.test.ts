import { describe, expect, it } from "vitest";
import { validarFoto, validarXml } from "./validation.ts";

const MB = 1024 * 1024;
const arquivo = (nome: string, bytes: number, tipo = "") =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

describe("validarXml (US-01)", () => {
  it("CT-02: rejeita arquivo com extensão diferente de .xml", () => {
    expect(validarXml(arquivo("nota.pdf", 10))).toContain(".xml");
  });

  it("CT-02: aceita extensão .xml em maiúsculas", () => {
    expect(validarXml(arquivo("NOTA.XML", 10))).toBeNull();
  });

  it("rejeita arquivo vazio", () => {
    expect(validarXml(arquivo("nota.xml", 0))).toBe("O arquivo está vazio.");
  });

  it("BVA: aceita exatamente 1 MiB", () => {
    expect(validarXml(arquivo("nota.xml", 1 * MB))).toBeNull();
  });

  it("BVA: rejeita 1 MiB + 1 byte", () => {
    expect(validarXml(arquivo("nota.xml", 1 * MB + 1))).toContain("limite é 1 MB");
  });
});

describe("validarFoto (US-02)", () => {
  it("aceita JPG e PNG", () => {
    expect(validarFoto(arquivo("a.jpg", 10, "image/jpeg"))).toBeNull();
    expect(validarFoto(arquivo("a.png", 10, "image/png"))).toBeNull();
  });

  it("rejeita outros tipos de arquivo", () => {
    expect(validarFoto(arquivo("a.gif", 10, "image/gif"))).toContain("JPG ou PNG");
  });

  it("rejeita foto vazia", () => {
    expect(validarFoto(arquivo("a.jpg", 0, "image/jpeg"))).toBe("A foto está vazia.");
  });

  it("BVA: aceita exatamente 5 MiB e rejeita 5 MiB + 1 byte", () => {
    expect(validarFoto(arquivo("a.jpg", 5 * MB, "image/jpeg"))).toBeNull();
    expect(validarFoto(arquivo("a.jpg", 5 * MB + 1, "image/jpeg"))).toContain("limite é 5 MB");
  });
});