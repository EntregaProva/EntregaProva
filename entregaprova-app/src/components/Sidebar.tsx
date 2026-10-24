interface SidebarProps {
  onHelp: () => void;
}

export default function Sidebar({ onHelp }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="EntregaProva - início">
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="brand-logo" />
      </a>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>
        <a className="nav-item active" href="#"><span>▦</span> Visão geral</a>
        <a className="nav-item" href="#entregas"><span>▣</span> Entregas</a>
        <a className="nav-item" href="#comprovantes"><span>✓</span> Comprovantes</a>
        <a className="nav-item" href="#relatorios"><span>▤</span> Relatórios</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">?</div>
          <strong>Precisa de ajuda?</strong>
          <p>Estamos aqui para ajudar você.</p>
          <button type="button" className="button secondary small" onClick={onHelp}>
            Falar com suporte
          </button>
        </div>
        <div className="profile">
          <div className="avatar">TR</div>
          <div>
            <strong>Transportes Rápidos</strong>
            <small>Plano profissional</small>
          </div>
          <span className="dots">•••</span>
        </div>
      </div>
    </aside>
  );
}
