import ApiStatus from "./ApiStatus.tsx";

interface TopBarProps {
  onNotifications: () => void;
}

export default function TopBar({ onNotifications }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="mobile-brand">
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="mobile-logo" />
      </div>
      <div className="breadcrumb">
        Painel <span>/</span> Visão geral
      </div>
      <div className="top-actions">
        <ApiStatus />
        <button
          type="button"
          className="icon-button"
          aria-label="Notificações"
          title="Notificações"
          onClick={onNotifications}
        >
          ♧<i></i>
        </button>
        <div className="top-avatar">TR</div>
      </div>
    </header>
  );
}
