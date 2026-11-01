import { XMLParser, XMLValidator } from "fast-xml-parser";
import { validateNFeKey } from "./nfeKeyValidator.js";
import { HttpError } from "./httpError.js";

// 1 MB interpreted as 1 MiB (1,048,576 bytes), excluding the JSON envelope.
export const MAX_XML_BYTES = 1024 * 1024;

export function parseNFeXML(xmlContent: unknown) {
  if (typeof xmlContent !== "string" || !xmlContent.trim()) {
    throw new HttpError(400, "Conteúdo XML obrigatório");
  }
  if (Buffer.byteLength(xmlContent, "utf8") > MAX_XML_BYTES) {
    throw new HttpError(413, "XML excede o limite de 1 MB");
  }
  // Reject DTDs before validation AND parsing; never echo the input.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xmlContent) || xmlContent.includes("\0")) {
    throw new HttpError(422, "Declarações XML não permitidas");
  }
  if (XMLValidator.validate(xmlContent) !== true) throw new HttpError(422, "XML malformado");
  let parsed;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false,
      parseAttributeValue: false, parseTagValue: false, allowBooleanAttributes: false,
    }).parse(xmlContent);
  } catch {
    throw new HttpError(422, "XML malformado");
  }
  const nfe = parsed.NFe?.infNFe ?? parsed.nfeProc?.NFe?.infNFe;
  if (!nfe || Array.isArray(nfe) || nfe["@_versao"] !== "4.00") {
    throw new HttpError(422, "NF-e deve ter estrutura válida e versão 4.00");
  }
  const id = nfe["@_Id"];
  const chave = typeof id === "string" && /^NFe\d{44}$/.test(id) ? id.slice(3) : "";
  const validation = validateNFeKey(chave);
  if (!validation.isValid) throw new HttpError(422, validation.reason!);
  if (nfe.ide?.cDV !== chave[43]) throw new HttpError(422, "cDV diverge da chave NF-e");
  const numero = nfe.ide?.nNF;
  const valor = nfe.total?.ICMSTot?.vNF;
  const destinatario = nfe.dest?.xNome;
  if (typeof numero !== "string" || !/^\d+$/.test(numero) ||
      typeof valor !== "string" || !/^\d+(\.\d{1,2})?$/.test(valor) ||
      !Number.isFinite(Number(valor)) || typeof destinatario !== "string" || !destinatario.trim()) {
    throw new HttpError(422, "Campos obrigatórios da NF-e inválidos");
  }
  return { chave, numero, valorTotal: Number(valor), destinatario };
}
