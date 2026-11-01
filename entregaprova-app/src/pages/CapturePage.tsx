import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { listDeliveries, sendProof } from "../api/deliveries.ts";
import { mensagemDoErro } from "../api/client.ts";
import { MAX_PHOTO_MB } from "../config.ts";
import { formatarDataHora, novaChaveDeIdempotencia } from "../format.ts";
import { useAsyncData } from "../hooks/useAsyncData.ts";
import { infoDoStatus } from "../status.ts";
import { validarFoto } from "../validation.ts";
import StateMessage from "../components/StateMessage.tsx";
import type { View } from "../views.ts";

export default function CapturePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { data, error, loading, reload } = useAsyncData(listDeliveries);

  const [entregaId, setEntregaId] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturadaEm, setCapturadaEm] = useState<string | null>(null);
  const [recebedor, setRecebedor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // A mesma chave é reutilizada se o envio falhar e for repetido (evita duplicar a imagem).
  const chave = useRef(novaChaveDeIdempotencia());

  useEffect(() => {
    if (!foto) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const handleFoto = (event: ChangeEvent<HTMLInputElement>) => {
    const escolhida = event.target.files?.[0] ?? null;
    setSucesso(null);
    setFoto(escolhida);
    setCapturadaEm(escolhida ? new Date().toISOString() : null);
    setErro(escolhida ? validarFoto(escolhida) : null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entregaId) return setErro("Escolha a entrega.");
    if (!foto || !capturadaEm) return setErro("Tire ou escolha a foto do comprovante.");
    if (!recebedor.trim()) return setErro("Informe o nome de quem recebeu.");
    const problema = validarFoto(foto);
    if (problema) return setErro(problema);

    setErro(null);
    setEnviando(true);
    try {
      await sendProof({
        deliveryId: entregaId,
        photo: foto,
        receiverName: recebedor.trim(),
        capturedAt: capturadaEm,
        idempotencyKey: chave.current,
      });
      setSucesso("Comprovante enviado com sucesso.");
      chave.current = novaChaveDeIdempotencia(); // próxima captura = chave nova
      setEntregaId("");
      setFoto(null);
      setCapturadaEm(null);
      setRecebedor("");
      setFormKey((k) => k + 1); // limpa o campo de arquivo
      reload();
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
          <p className="eyebrow">JORNADA 2</p>
          <h1>Capturar comprovante</h1>
          <p className="muted">Tire a foto do canhoto e informe quem recebeu a mercadoria.</p>
        </div>
      </section>

      {loading && <StateMessage kind="loading" message="Carregando entregas..." />}
      {!loading && error && <StateMessage kind="error" message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <StateMessage
          kind="empty"
          message="Não há entregas para comprovar. Importe um XML primeiro."
          actionLabel="Importar XML"
          onAction={() => onNavigate("importar")}
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <form key={formKey} className="panel form-panel" onSubmit={handleSubmit} noValidate>
          <label htmlFor="entrega">Entrega</label>
          <select id="entrega" value={entregaId} onChange={(e) => setEntregaId(e.target.value)}>
            <option value="">Selecione a entrega...</option>
            {data.map((d) => (
              <option key={d.id} value={d.id}>
                NF-e {d.invoiceNumber} — {d.recipient} ({infoDoStatus(d.status).label})
              </option>
            ))}
          </select>

          <label htmlFor="foto">Foto do comprovante</label>
          <input
            id="foto"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            aria-describedby="foto-dica"
          />
          <p id="foto-dica" className="hint">JPG ou PNG, até {MAX_PHOTO_MB} MB. No celular, abre a câmera traseira.</p>
          {preview && <img src={preview} alt="Pré-visualização do comprovante" className="proof-preview" />}

          <label htmlFor="recebedor">Nome de quem recebeu</label>
          <input id="recebedor" type="text" autoComplete="off" value={recebedor} onChange={(e) => setRecebedor(e.target.value)} />

          <p className="hint">
            Data e hora da captura: {capturadaEm ? formatarDataHora(capturadaEm) : "registradas ao escolher a foto"}
          </p>

          {erro && (
            <div className="alert error" role="alert">
              <span aria-hidden="true">✕</span> {erro}
            </div>
          )}
          {sucesso && (
            <div className="alert success" role="status">
              <span aria-hidden="true">✓</span> {sucesso}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="button primary" disabled={enviando}>
              {enviando ? "Enviando..." : erro && foto ? "Tentar de novo" : "Enviar comprovante"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
