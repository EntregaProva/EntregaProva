export type View = "visao" | "entregas" | "importar" | "capturar" | "conferir" | "usuarios";

export const TITULO: Record<View, string> = {
  visao: "Visão geral",
  entregas: "Entregas",
  importar: "Importar XML",
  capturar: "Capturar comprovante",
  conferir: "Conferir comprovante",
  usuarios: "Cadastrar usuário",
};
