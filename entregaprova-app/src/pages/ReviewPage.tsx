import { useCallback, useState, type FormEvent } from "react";
import { getDelivery, submitReview, type ReviewDecision } from "../api/deliveries.ts";
import { mensagemDoErro } from "../api/client.ts";
import { formatarDataHora } from "../format.ts";
import { useAsyncData } from "../hooks/useAsyncData.ts";
import { useDeliveryPages } from "../hooks/useDeliveryPages.ts";
import DeliveryPagination from "../components/DeliveryPagination.tsx";
import StateMessage from "../components/StateMessage.tsx";
import type { View } from "../views.ts";

export default function ReviewPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { data, error, loading, reload, firstPage, pagination } = useDeliveryPages("COMPROVADO");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = data?.find(entry => entry.id === selectedId) ?? data?.[0];

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">JORNADA 3</p>
          <h1>Conferir comprovante</h1>
          <p className="muted">Compare os dados do XML com a foto enviada e aprove ou rejeite a entrega.</p>
        </div>
      </section>

      {message && <div className="alert success" role="status">✓ {message}</div>}
      {loading && <StateMessage kind="loading" message="Carregando comprovantes para conferência..." />}
      {!loading && error && <StateMessage kind="error" message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <StateMessage
          kind="empty"
          message={pagination.previous ? "Não há comprovantes nesta página." : "Não há comprovantes aguardando conferência."}
          actionLabel="Ver entregas"
          onAction={() => onNavigate("entregas")}
        />
      )}
      {!loading && !error && selected && (
        <section className="panel review-panel">
          {data && data.length > 1 && (
            <>
              <label className="review-select-label" htmlFor="review-delivery">Entrega para conferir</label>
              <select id="review-delivery" value={selected.id} disabled={saving} onChange={(event) => {
                setSelectedId(event.target.value);
                setMessage(null);
              }}>
                {data.map(entry => <option key={entry.id} value={entry.id}>NF-e {entry.invoiceNumber} — {entry.recipient}</option>)}
              </select>
            </>
          )}
          <ReviewDetails
            key={selected.id}
            id={selected.id}
            saving={saving}
            setSaving={setSaving}
            refreshQueue={firstPage}
            onReviewed={result => {
              setMessage(result);
              setSelectedId("");
              firstPage();
            }}
          />
        </section>
      )}
      <DeliveryPagination {...pagination} disabled={loading || saving} />
    </>
  );
}

function ReviewDetails({ id, saving, setSaving, refreshQueue, onReviewed }: {
  id: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  refreshQueue: () => void;
  onReviewed: (message: string) => void;
}) {
  const load = useCallback(() => getDelivery(id), [id]);
  const { data: item, error, loading, reload } = useAsyncData(load);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  if (loading) return <StateMessage kind="loading" message="Carregando o comprovante selecionado..." />;
  if (error) return <StateMessage kind="error" message={error} onRetry={reload} />;
  if (!item) return null;
  if (item.status !== "COMPROVADO") {
    return <StateMessage kind="empty" message="Esta entrega saiu da fila de conferência." actionLabel="Atualizar fila" onAction={refreshQueue} />;
  }
  const proof = item.proof;
  const refreshPhoto = () => {
    setPhotoFailed(false);
    reload();
  };
  if (!proof || photoFailed) {
    return <StateMessage kind="error" message="O comprovante desta entrega está indisponível." onRetry={refreshPhoto} />;
  }

  const decide = async (decision: ReviewDecision) => {
    if (saving) return;
    if (decision === "rejected" && !reason.trim()) {
      setActionError("Informe o motivo da rejeição.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await submitReview({ deliveryId: id, decision, reason: decision === "rejected" ? reason.trim() : undefined });
      onReviewed(decision === "approved" ? "Comprovante aprovado." : "Comprovante rejeitado.");
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
    <div className="review-columns">
      <article className="review-side">
        <h2>Dados do XML</h2>
        <dl className="review-facts">
          <div><dt>Nota fiscal</dt><dd>{item.invoiceNumber}</dd></div>
          <div><dt>Chave de acesso</dt><dd>{item.accessKey}</dd></div>
          <div><dt>Destinatário</dt><dd>{item.recipient}</dd></div>
        </dl>
      </article>
      <article className="review-side">
        <h2>Foto do comprovante</h2>
        <img className="review-photo" src={proof.photoUrl} alt={`Comprovante da NF-e ${item.invoiceNumber}`} onError={() => setPhotoFailed(true)} />
        {proof.expiresAt && <p className="hint">Link temporário válido até {formatarDataHora(proof.expiresAt)}.</p>}
        <button type="button" className="button secondary" disabled={saving} onClick={refreshPhoto}>
          Atualizar comprovante
        </button>
        <dl className="review-facts">
          <div><dt>Recebido por</dt><dd>{proof.receiverName}</dd></div>
          <div><dt>Capturado em</dt><dd>{formatarDataHora(proof.capturedAt)}</dd></div>
        </dl>
      </article>
    </div>
    {actionError && <div className="alert error" role="alert">✕ {actionError}</div>}
    <form className="review-actions" onSubmit={handleSubmit}>
      <label htmlFor="review-reason">Motivo da rejeição <span>(obrigatório para rejeitar)</span></label>
      <textarea id="review-reason" rows={3} value={reason} disabled={saving} onChange={(e) => setReason(e.target.value)} placeholder="Descreva a divergência encontrada" />
      <div className="form-actions">
        <button type="button" className="button primary" disabled={saving} onClick={() => void decide("approved")}>{saving ? "Salvando..." : "Aprovar comprovante"}</button>
        <button type="submit" className="button danger-button" disabled={saving}>{saving ? "Salvando..." : "Rejeitar com motivo"}</button>
      </div>
    </form>
    </>
  );
}
