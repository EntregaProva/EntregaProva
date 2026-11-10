import { useState, type ChangeEvent, type FormEvent } from "react";
import { importXml, type Delivery } from "../api/deliveries.ts";
import { mensagemDoErro } from "../api/client.ts";
import { MAX_XML_MB } from "../config.ts";
import { validarXml } from "../validation.ts";
import type { View } from "../views.ts";

export default function ImportXmlPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [driverId, setDriverId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState<Delivery | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const escolhido = event.target.files?.[0] ?? null;
    setCriada(null);
    setArquivo(escolhido);
    setErro(escolhido ? validarXml(escolhido) : null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!arquivo) {
      setErro("Escolha um arquivo XML para importar.");
      return;
    }
    if (!driverId.trim()) {
      setErro("Informe o UID do motorista que receberá esta entrega.");
      return;
    }
    const problema = validarXml(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const entrega = await importXml(arquivo, driverId.trim());
      setCriada(entrega);
      setArquivo(null);
      setFormKey((k) => k + 1); // limpa o campo de arquivo
    } catch (e: unknown) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">JORNADA 1</p>
          <h1>Importar XML</h1>
          <p className="muted">Envie o XML de uma NF-e 4.00 e atribua a entrega a um motorista.</p>
        </div>
      </section>

      <form key={formKey} className="panel form-panel" onSubmit={handleSubmit} noValidate>
        <label htmlFor="xml">Arquivo XML da NF-e 4.00</label>
        <input id="xml" type="file" accept=".xml,text/xml,application/xml" onChange={handleFile} aria-describedby="xml-dica" />
        <p id="xml-dica" className="hint">Somente XML de NF-e 4.00, até {MAX_XML_MB} MB. CT-e ainda não é aceito pela API.</p>

        <label htmlFor="driver-id">UID do motorista</label>
        <input id="driver-id" type="text" value={driverId} onChange={(event) => setDriverId(event.target.value)} autoComplete="off" aria-describedby="driver-id-hint" />
        <p id="driver-id-hint" className="hint">Use o UID de um motorista da mesma empresa. A API ainda não oferece uma lista de motoristas para seleção.</p>

        {erro && (
          <div className="alert error" role="alert">
            <span aria-hidden="true">✕</span> {erro}
          </div>
        )}
        {criada && (
          <div className="alert success" role="status">
            <span aria-hidden="true">✓</span> Entrega criada: NF-e {criada.invoiceNumber} para {criada.recipient}.
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="button primary" disabled={enviando}>
            {enviando ? "Importando..." : "Importar XML"}
          </button>
          {criada && (
            <button type="button" className="button secondary" onClick={() => onNavigate("entregas")}>
              Ver entregas
            </button>
          )}
        </div>
      </form>
    </>
  );
}
