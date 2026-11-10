import type { View } from "../views.ts";

interface SidebarProps {
  view: View;
  role: "admin" | "operator" | "driver";
  onNavigate: (view: View) => void;
}

const ITENS: { view: View; icon: string; label: string }[] = [
  { view: "entregas", icon: "▣", label: "Entregas" },
  { view: "importar", icon: "↑", label: "Importar XML" },
  { view: "capturar", icon: "◉", label: "Capturar comprovante" },
  { view: "conferir", icon: "⇄", label: "Conferir comprovantes" },
];

const VIEWS_BY_ROLE: Record<SidebarProps["role"], View[]> = {
  admin: ["entregas", "importar", "capturar", "conferir"],
  operator: ["entregas", "importar", "conferir"],
  driver: ["entregas", "capturar"],
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
          <a
            key={item.view}
            href="#"
            className={`nav-item${view === item.view ? " active" : ""}`}
            aria-label={item.label}
            aria-current={view === item.view ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.view);
            }}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
