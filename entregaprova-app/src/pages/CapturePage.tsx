import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { sendProof } from "../api/deliveries.ts";
import { ApiError, mensagemDoErro } from "../api/client.ts";
import { MAX_PHOTO_MB } from "../config.ts";
import { formatarDataHora, novaChaveDeIdempotencia } from "../format.ts";
import { compressProofPhoto } from "../imageCompression.ts";
import { useDeliveryPages } from "../hooks/useDeliveryPages.ts";
import DeliveryPagination from "../components/DeliveryPagination.tsx";
import { infoDoStatus } from "../status.ts";
import { validarFoto } from "../validation.ts";
import StateMessage from "../components/StateMessage.tsx";
import type { View } from "../views.ts";

interface ProofAttempt {
  deliveryId: string;
  photo: File;
  receiverName: string;
  capturedAt: string;
  key: string;
  uncertain: boolean;
}

export default function CapturePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { data, error, loading, reload, pagination } = useDeliveryPages();
  const [entregaId, setEntregaId] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturadaEm, setCapturadaEm] = useState<string | null>(null);
  const [recebedor, setRecebedor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const tentativa = useRef<ProofAttempt | null>(null);
  const elegiveis = (data ?? []).filter((d) => ["PENDENTE", "REJEITADO"].includes(d.status));

  useEffect(() => {
    if (!foto) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const handleFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const original = event.target.files?.[0] ?? null;
    setSucesso(null);
    setFoto(null);
    setCapturadaEm(null);
    setErro(original ? validarFoto(original) : null);
    if (!original || validarFoto(original)) return;

    const momentoCaptura = new Date().toISOString();
    setPreparandoFoto(true);
    try {
      const compactada = await compressProofPhoto(original);
      setFoto(compactada);
      setCapturadaEm(momentoCaptura);
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível preparar a foto.");
    } finally {
      setPreparandoFoto(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entregaId) return setErro("Escolha a entrega.");
    if (!foto || !capturadaEm) return setErro("Tire ou escolha a foto do comprovante.");
    if (!recebedor.trim()) return setErro("Informe o nome de quem recebeu.");
    const problema = validarFoto(foto);
    if (problema) return setErro(problema);

    const previous = tentativa.current;
    const sameOperation = Boolean(previous && previous.deliveryId === entregaId && previous.photo === foto &&
      previous.receiverName === recebedor.trim() && previous.capturedAt === capturadaEm);
    if (!sameOperation && previous?.uncertain) {
      const confirmed = window.confirm(
        "O resultado do envio anterior é incerto. Se ele foi salvo, esta será uma nova operação. Deseja continuar com os dados atuais?",
      );
      if (!confirmed) return;
    }

    const operation: ProofAttempt = sameOperation && previous ? previous : {
      deliveryId: entregaId,
      photo: foto,
      receiverName: recebedor.trim(),
      capturedAt: capturadaEm,
      key: novaChaveDeIdempotencia(),
      uncertain: false,
    };
    tentativa.current = operation;
    setErro(null);
    setEnviando(true);
    try {
      await sendProof({
        deliveryId: operation.deliveryId,
        photo: operation.photo,
        receiverName: operation.receiverName,
        capturedAt: operation.capturedAt,
        idempotencyKey: operation.key,
      });
      tentativa.current = null;
      setSucesso("Comprovante enviado com sucesso.");
      setEntregaId("");
      setFoto(null);
      setCapturadaEm(null);
      setRecebedor("");
      setFormKey((k) => k + 1);
      reload();
    } catch (e: unknown) {
      if (tentativa.current === operation && e instanceof ApiError) {
        operation.uncertain = e.status === 0 || e.status >= 500;
      }
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const isSameAttempt = Boolean(tentativa.current && foto && capturadaEm &&
    tentativa.current.deliveryId === entregaId && tentativa.current.photo === foto &&
    tentativa.current.receiverName === recebedor.trim() && tentativa.current.capturedAt === capturadaEm);

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
      {!loading && !error && data && elegiveis.length === 0 && (
        <StateMessage kind="empty" message="Não há entregas pendentes ou rejeitadas nesta página." actionLabel="Importar XML" onAction={() => onNavigate("importar")} />
      )}

      {!loading && !error && elegiveis.length > 0 && (
        <form key={formKey} className="panel form-panel" onSubmit={handleSubmit} noValidate>
          <label htmlFor="entrega">Entrega</label>
          <select id="entrega" value={entregaId} disabled={enviando} onChange={(e) => setEntregaId(e.target.value)}>
            <option value="">Selecione a entrega...</option>
            {elegiveis.map((d) => (
              <option key={d.id} value={d.id}>
                NF-e {d.invoiceNumber} — {d.recipient} ({infoDoStatus(d.status).label})
              </option>
            ))}
          </select>

          <label htmlFor="foto">Foto do comprovante</label>
          <input id="foto" type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => void handleFoto(event)} disabled={enviando || preparandoFoto} aria-describedby="foto-dica" />
          <p id="foto-dica" className="hint">JPG ou PNG, até {MAX_PHOTO_MB} MB antes da compressão. A imagem é reduzida no navegador para até 1280 px e aproximadamente 300 KB. No celular, abre a câmera traseira.</p>
          {preparandoFoto && <StateMessage kind="loading" message="Preparando e comprimindo a foto..." />}
          {preview && <img src={preview} alt="Pré-visualização do comprovante comprimido" className="proof-preview" />}

          <label htmlFor="recebedor">Nome de quem recebeu</label>
          <input id="recebedor" type="text" autoComplete="off" value={recebedor} disabled={enviando} onChange={(e) => setRecebedor(e.target.value)} />

          <p className="hint">Data e hora da captura: {capturadaEm ? formatarDataHora(capturadaEm) : "registradas ao escolher a foto"}</p>
          {tentativa.current?.uncertain && <p className="hint">A tentativa anterior pode ter sido salva. Reenvie exatamente os mesmos dados para usar a mesma chave de idempotência.</p>}

          {erro && <div className="alert error" role="alert"><span aria-hidden="true">✕</span> {erro}</div>}
          {sucesso && <div className="alert success" role="status"><span aria-hidden="true">✓</span> {sucesso}</div>}

          <div className="form-actions">
            <button type="submit" className="button primary" disabled={enviando || preparandoFoto}>
              {enviando ? "Enviando..." : isSameAttempt ? "Tentar de novo" : "Enviar comprovante"}
            </button>
          </div>
        </form>
      )}
      <DeliveryPagination
        page={pagination.page}
        disabled={loading || enviando || preparandoFoto}
        previous={pagination.previous && (() => { setEntregaId(""); pagination.previous?.(); })}
        next={pagination.next && (() => { setEntregaId(""); pagination.next?.(); })}
      />
    </>
  );
}
