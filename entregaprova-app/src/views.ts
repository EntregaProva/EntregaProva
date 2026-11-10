export type View = "entregas" | "importar" | "capturar" | "conferir";

export const TITULO: Record<View, string> = {
  entregas: "Entregas",
  importar: "Importar XML",
  capturar: "Capturar comprovante",
  conferir: "Conferir comprovante",
};
