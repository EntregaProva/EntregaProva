import ApiStatus from "./ApiStatus.tsx";
import { useAuth } from "../auth/useAuth.ts";
import { TITULO, type View } from "../views.ts";

export default function TopBar({ view }: { view: View }) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="mobile-logo" />
      </div>
      <div className="breadcrumb">
        Painel <span>/</span> {TITULO[view]}
      </div>
      <div className="top-actions">
        <ApiStatus />
        <div className="top-avatar" title={email} aria-hidden="true">
          {email.slice(0, 2).toUpperCase() || "?"}
        </div>
        <button type="button" className="button secondary small" onClick={() => void signOut()}>
          Sair
        </button>
      </div>
    </header>
  );
}
