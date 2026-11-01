import { useState } from "react";
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
import type { View } from "./views.ts";

function Shell() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("entregas");

  if (loading) {
    return (
      <div className="login-wrap">
        <StateMessage kind="loading" message="Verificando sua sessão..." />
      </div>
    );
  }
  if (!user) return <LoginPage />;

  return (
    <>
      <Sidebar view={view} onNavigate={setView} />
      <main className="main">
        <TopBar view={view} />
        {view === "entregas" && <DeliveriesPage onNavigate={setView} />}
        {view === "importar" && <ImportXmlPage onNavigate={setView} />}
        {view === "capturar" && <CapturePage onNavigate={setView} />}
        {view === "conferir" && <ReviewPage onNavigate={setView} />}
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
