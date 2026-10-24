interface QuickActionsProps {
  onUpload: () => void;
  onReview: () => void;
  onReport: () => void;
}

export default function QuickActions({ onUpload, onReview, onReport }: QuickActionsProps) {
  return (
    <article className="panel action-panel">
      <div className="panel-heading">
        <div>
          <h2>Acesso rápido</h2>
          <p className="muted">O que você precisa fazer?</p>
        </div>
      </div>
      <button type="button" className="quick-action" onClick={onUpload}>
        <span className="quick-icon">↑</span>
        <span>
          <strong>Enviar comprovante</strong>
          <small>Adicione uma foto ou arquivo</small>
        </span>
        <b>›</b>
      </button>
      <button type="button" className="quick-action" onClick={onReview}>
        <span className="quick-icon amber">✓</span>
        <span>
          <strong>Revisar pendências</strong>
          <small>Confira documentos divergentes</small>
        </span>
        <b>›</b>
      </button>
      <button type="button" className="quick-action" onClick={onReport}>
        <span className="quick-icon violet">▤</span>
        <span>
          <strong>Gerar pacote de faturamento</strong>
          <small>Reúna os comprovantes validados</small>
        </span>
        <b>›</b>
      </button>
      <div className="tip">
        <span>✦</span>
        <p>
          <strong>Dica da EntregaProva</strong>
          <br />
          Comprovantes organizados ajudam a agilizar o faturamento.
        </p>
      </div>
    </article>
  );
}
