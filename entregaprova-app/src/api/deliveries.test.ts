import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./client.ts", () => ({ apiFetch }));

import { getDelivery, importXml, listDeliveries, sendProof, submitReview } from "./deliveries.ts";

describe("contrato da API de entregas", () => {
  beforeEach(() => apiFetch.mockReset());

  it("envia o XML como texto dentro de JSON e adapta a resposta do backend", async () => {
    apiFetch.mockResolvedValue({
      id: "entrega-1",
      numeroNF: "123",
      chaveNFe: "chave-abc",
      destinatario: "Ana",
      status: "PENDENTE",
      criadoEm: "2026-11-18T12:00:00.000Z",
    });
    const file = new File(["<NFe />"], "nota.xml", { type: "application/xml" });

    await expect(importXml(file, "motorista-7")).resolves.toMatchObject({
      id: "entrega-1", invoiceNumber: "123", accessKey: "chave-abc", recipient: "Ana", status: "PENDENTE",
    });

    expect(apiFetch).toHaveBeenCalledWith("/deliveries/xml", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xmlContent: "<NFe />", driverId: "motorista-7" }),
    }));
  });

  it("usa cursor/status da paginação e converte os nomes/status do backend", async () => {
    apiFetch.mockResolvedValue({
      itens: [{ id: "e-2", numeroNF: "22", chaveNFe: "123456789", destinatario: "Bia", status: "comprovado", criadoEm: "ontem" }],
      proximoCursor: "cursor-2",
    });

    await expect(listDeliveries("cursor-1", "COMPROVADO")).resolves.toMatchObject({
      nextCursor: "cursor-2",
      items: [{ invoiceNumber: "22", accessKey: "123456789", recipient: "Bia", status: "COMPROVADO" }],
    });
    expect(apiFetch).toHaveBeenCalledWith("/deliveries?cursor=cursor-1&status=COMPROVADO");
  });

  it("busca o detalhe da entrega por ID codificado", async () => {
    apiFetch.mockResolvedValue({ id: "a/b", status: "CONFERIDO", comprovante: {
      arquivoUrl: "https://storage/foto", recebedorNome: "João", dataHoraEntrega: "2026-11-18T10:00:00Z",
    } });

    await expect(getDelivery("a/b")).resolves.toMatchObject({
      id: "a/b", status: "CONFERIDO", proof: { photoUrl: "https://storage/foto", receiverName: "João" },
    });
    expect(apiFetch).toHaveBeenCalledWith("/deliveries/a%2Fb");
  });

  it("envia comprovante nos campos multipart e conserva a Idempotency-Key", async () => {
    apiFetch.mockResolvedValue({ id: "e-3", status: "COMPROVADO", message: "ok", comprovante: {} });
    const photo = new File(["foto"], "comprovante.jpg", { type: "image/jpeg" });

    await sendProof({ deliveryId: "e-3", photo, receiverName: "Lia", capturedAt: "agora", idempotencyKey: "key-fixa" });

    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe("/deliveries/e-3/proof");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Idempotency-Key": "key-fixa" });
    expect(init.body.get("file")).toBe(photo);
    expect(init.body.get("recebedorNome")).toBe("Lia");
    expect(init.body.get("dataHoraEntrega")).toBe("agora");
  });

  it.each([
    [{ deliveryId: "e-4", decision: "approved" as const }, { aprovado: true }],
    [{ deliveryId: "e-4", decision: "rejected" as const, reason: "Foto ilegível" }, { aprovado: false, motivoRejeicao: "Foto ilegível" }],
  ])("mapeia a decisão de conferência para o contrato do backend", async (input, expected) => {
    apiFetch.mockResolvedValue(undefined);
    await submitReview(input);
    expect(apiFetch).toHaveBeenCalledWith("/deliveries/e-4/check", expect.objectContaining({
      method: "PATCH", body: JSON.stringify(expected),
    }));
  });

  it("não converte silenciosamente um status que o frontend desconhece", async () => {
    apiFetch.mockResolvedValue({ id: "e-5", status: "EM_ROTA" });
    await expect(getDelivery("e-5")).rejects.toThrow("status de entrega desconhecido");
  });
});
