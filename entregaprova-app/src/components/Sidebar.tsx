import type { View } from "../views.ts";
import Icon, { type IconName } from "./Icon.tsx";

interface SidebarProps {
  view: View;
  role: "admin" | "operator" | "driver";
  onNavigate: (view: View) => void;
}

const ITENS: { view: View; icon: IconName; label: string }[] = [
  { view: "visao", icon: "overview", label: "Visão geral" },
  { view: "entregas", icon: "deliveries", label: "Entregas" },
  { view: "importar", icon: "document", label: "Importar XML" },
  { view: "capturar", icon: "camera", label: "Capturar comprovante" },
  { view: "conferir", icon: "review", label: "Conferir comprovantes" },
  { view: "usuarios", icon: "users", label: "Cadastrar usuário" },
];

const VIEWS_BY_ROLE: Record<SidebarProps["role"], View[]> = {
  admin: ["visao", "entregas", "importar", "capturar", "conferir", "usuarios"],
  operator: ["visao", "entregas", "importar", "conferir"],
  driver: ["visao", "entregas", "capturar"],
};

export default function Sidebar({ view, role, onNavigate }: SidebarProps) {
  const allowedViews = VIEWS_BY_ROLE[role];
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        aria-label="EntregaProva - início"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("entregas");
        }}
      >
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="brand-logo" />
      </a>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav aria-label="Menu principal">
        {ITENS.filter((item) => allowedViews.includes(item.view)).map((item) => (
          <button
            key={item.view}
            className={`nav-item${view === item.view ? " active" : ""}`}
            aria-current={view === item.view ? "page" : undefined}
            type="button"
            onClick={() => onNavigate(item.view)}
          >
            <span className="nav-icon"><Icon name={item.icon} size={19} /></span> <span className="nav-text">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
