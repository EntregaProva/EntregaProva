export type View = "entregas" | "importar" | "capturar" | "conferir" | "usuarios";

export const TITULO: Record<View, string> = {
  entregas: "Entregas",
  importar: "Importar XML",
  capturar: "Capturar comprovante",
  conferir: "Conferir comprovante",
  usuarios: "Cadastrar usuário",
};
