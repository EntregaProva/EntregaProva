import { useState, type FormEvent } from "react";
import { listReviewQueue, submitReview, type ReviewDecision } from "../api/deliveries.ts";
import { mensagemDoErro } from "../api/client.ts";
import { formatarDataHora } from "../format.ts";
import { useAsyncData } from "../hooks/useAsyncData.ts";
import StateMessage from "../components/StateMessage.tsx";
import type { View } from "../views.ts";

export default function ReviewPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { data, error, loading, reload } = useAsyncData(listReviewQueue);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const item = data?.find((entry) => entry.deliveryId === selectedId) ?? data?.[0];

  const decide = async (decision: ReviewDecision) => {
    if (!item) return;
    if (decision === "rejected" && !reason.trim()) {
      setActionError("Informe o motivo da rejeição.");
      return;
    }
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await submitReview({ deliveryId: item.deliveryId, decision, reason: decision === "rejected" ? reason.trim() : undefined });
      setMessage(decision === "approved" ? "Comprovante aprovado." : "Comprovante rejeitado.");
      setReason("");
      await reload();
    } catch (e: unknown) {
      setActionError(mensagemDoErro(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void decide("rejected");
  };

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">JORNADA 3</p>
          <h1>Conferir comprovante</h1>
          <p className="muted">Compare os dados do XML com a foto enviada e aprove ou rejeite a entrega.</p>
        </div>
      </section>

      {loading && <StateMessage kind="loading" message="Carregando comprovantes para conferência..." />}
      {!loading && error && <StateMessage kind="error" message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <StateMessage kind="empty" message="Não há comprovantes aguardando conferência." actionLabel="Ver entregas" onAction={() => onNavigate("entregas")} />
      )}

      {!loading && !error && item && (
        <section className="panel review-panel">
          {data && data.length > 1 && (
            <label className="review-select-label" htmlFor="review-delivery">Entrega para conferir</label>
          )}
          {data && data.length > 1 && (
            <select id="review-delivery" value={item.deliveryId} onChange={(e) => { setSelectedId(e.target.value); setMessage(null); setActionError(null); }}>
              {data.map((entry) => <option key={entry.deliveryId} value={entry.deliveryId}>NF-e {entry.invoiceNumber} — {entry.recipient}</option>)}
            </select>
          )}
          <div className="review-columns">
            <article className="review-side">
              <h2>Dados do XML</h2>
              <dl className="review-facts">
                <div><dt>Nota fiscal</dt><dd>{item.xml.invoiceNumber}</dd></div>
                <div><dt>Chave de acesso</dt><dd>{item.xml.accessKey}</dd></div>
                <div><dt>Destinatário</dt><dd>{item.xml.recipient}</dd></div>
              </dl>
            </article>
            <article className="review-side">
              <h2>Foto do comprovante</h2>
              <img className="review-photo" src={item.proof.photoUrl} alt={`Comprovante da NF-e ${item.invoiceNumber}`} />
              <dl className="review-facts">
                <div><dt>Recebido por</dt><dd>{item.proof.receiverName}</dd></div>
                <div><dt>Capturado em</dt><dd>{formatarDataHora(item.proof.capturedAt)}</dd></div>
              </dl>
            </article>
          </div>
          {message && <div className="alert success" role="status">✓ {message}</div>}
          {actionError && <div className="alert error" role="alert">✕ {actionError}</div>}
          <form className="review-actions" onSubmit={handleSubmit}>
            <label htmlFor="review-reason">Motivo da rejeição <span>(obrigatório para rejeitar)</span></label>
            <textarea id="review-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva a divergência encontrada" />
            <div className="form-actions">
              <button type="button" className="button primary" disabled={saving} onClick={() => void decide("approved")}>{saving ? "Salvando..." : "Aprovar comprovante"}</button>
              <button type="submit" className="button danger-button" disabled={saving}>{saving ? "Salvando..." : "Rejeitar com motivo"}</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
