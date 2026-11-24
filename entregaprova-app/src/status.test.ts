import { describe, expect, it } from "vitest";
import { infoDoStatus } from "./status.ts";

describe("infoDoStatus", () => {
  it.each([
    ["PENDENTE", "Pendente"],
    ["COMPROVADO", "Aguardando conferência"],
    ["CONFERIDO", "Conferida"],
    ["REJEITADO", "Rejeitada"],
  ])("traduz %s para %s", (status, rotulo) => {
    expect(infoDoStatus(status).label).toBe(rotulo);
  });

  it("aceita o status em minúsculas", () => {
    expect(infoDoStatus("conferido").label).toBe("Conferida");
  });

  it("mostra um status desconhecido sem quebrar a tela", () => {
    expect(infoDoStatus("CANCELADO")).toEqual({ label: "CANCELADO", icon: "•", css: "warning" });
  });
});