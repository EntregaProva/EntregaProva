import { XMLParser } from "fast-xml-parser";

export function parseNFeXML(xmlContent: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false, // Previne XML Entity Expansion (XXE)
    allowBooleanAttributes: false
  });

  try {
    const parsed = parser.parse(xmlContent);
    const nfe = parsed.NFe?.infNFe || parsed.nfeProc?.NFe?.infNFe;

    if (!nfe) {
      throw new Error("Estrutura da NF-e não encontrada no arquivo XML");
    }

    const chave = nfe["@_Id"] ? nfe["@_Id"].replace("NFe", "") : "";
    const numero = nfe.ide?.nNF || "";
    const valorTotal = nfe.total?.ICMSTot?.vNF || 0;
    const destinatario = nfe.dest?.xNome || "";

    return { chave, numero, valorTotal: Number(valorTotal), destinatario };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`XML malformado ou inválido: ${message}`);
  }
}