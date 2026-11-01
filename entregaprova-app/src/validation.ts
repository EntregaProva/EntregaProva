import { MAX_PHOTO_MB, MAX_XML_MB, PHOTO_TYPES } from "./config.ts";

const MB = 1024 * 1024;

// Devolve a mensagem de erro, ou null se o arquivo está ok.
export function validarXml(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".xml")) {
    return "Poxa! Seu arquivo não foi aceito :( Envie um arquivo .xml (NF-e ou CT-e).";
  }
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_XML_MB * MB) {
    return `Arquivo grande demais: o limite é ${MAX_XML_MB} MB.`;
  }
  return null;
}

export function validarFoto(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) {
    return "Poxa! Sua foto não foi aceita :( Use uma imagem JPG ou PNG.";
  }
  if (file.size === 0) return "A foto está vazia.";
  if (file.size > MAX_PHOTO_MB * MB) {
    return `Foto grande demais: o limite é ${MAX_PHOTO_MB} MB.`;
  }
  return null;
}
