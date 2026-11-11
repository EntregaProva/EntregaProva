import { useEffect, useState } from "react";
import AuthProvider from "./auth/AuthProvider.tsx";
import { useAuth } from "./auth/useAuth.ts";
import Sidebar from "./components/Sidebar.tsx";
import StateMessage from "./components/StateMessage.tsx";
import TopBar from "./components/TopBar.tsx";
import CapturePage from "./pages/CapturePage.tsx";
import DeliveriesPage from "./pages/DeliveriesPage.tsx";
import ImportXmlPage from "./pages/ImportXmlPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ReviewPage from "./pages/ReviewPage.tsx";
import RegisterUserPage from "./pages/RegisterUserPage.tsx";
import type { View } from "./views.ts";

const VIEWS_BY_ROLE: Record<"admin" | "operator" | "driver", View[]> = {
  admin: ["entregas", "importar", "capturar", "conferir", "usuarios"],
  operator: ["entregas", "importar", "conferir"],
  driver: ["entregas", "capturar"],
};

function Shell() {
  const { user, role, loading, signOut } = useAuth();
  const [view, setView] = useState<View>("entregas");
  const allowedViews = role ? VIEWS_BY_ROLE[role] : [];

  useEffect(() => {
    if (allowedViews.length && !allowedViews.includes(view)) setView(allowedViews[0]);
  }, [allowedViews, view]);

  if (loading) {
    return (
      <div className="login-wrap">
        <StateMessage kind="loading" message="Verificando sua sessão..." />
      </div>
    );
  }
  if (!user) return <LoginPage />;
  if (!role) {
    return <div className="login-wrap"><div className="panel form-panel"><div className="alert error" role="alert">Sua conta entrou, mas não recebeu um papel válido (admin, operator ou driver) nas claims do token. O backend precisa corrigir o seed e você deve entrar novamente.</div><button type="button" className="button secondary" onClick={() => void signOut()}>Sair</button></div></div>;
  }

  const navigate = (next: View) => {
    if (allowedViews.includes(next)) setView(next);
  };

  return (
    <>
      <Sidebar view={view} role={role} onNavigate={navigate} />
      <main className="main">
        <TopBar view={view} />
        {view === "entregas" && <DeliveriesPage onNavigate={navigate} />}
        {view === "importar" && role !== "driver" && <ImportXmlPage onNavigate={navigate} />}
        {view === "capturar" && (role === "driver" || role === "admin") && <CapturePage onNavigate={navigate} />}
        {view === "conferir" && role !== "driver" && <ReviewPage onNavigate={navigate} />}
        {view === "usuarios" && role === "admin" && <RegisterUserPage />}
        <footer>© 2026 EntregaProva · Da entrega à comprovação, sem perder o controle.</footer>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
