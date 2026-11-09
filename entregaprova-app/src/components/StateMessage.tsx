interface StateMessageProps {
  kind: "loading" | "empty" | "error";
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONE = { loading: "◌", empty: "∅", error: "✕" } as const;

// Estados da interface: carregando, vazio e erro.
export default function StateMessage({ kind, message, onRetry, actionLabel, onAction }: StateMessageProps) {
  return (
    <div className={`state-box ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span className="state-icon" aria-hidden="true">{ICONE[kind]}</span>
      <p>{message}</p>
      {kind === "error" && onRetry && (
        <button type="button" className="button secondary" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
      {kind === "empty" && onAction && actionLabel && (
        <button type="button" className="button primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
