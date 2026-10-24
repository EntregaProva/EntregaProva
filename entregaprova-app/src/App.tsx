import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import Sidebar from "./components/Sidebar.tsx";
import TopBar from "./components/TopBar.tsx";
import StatsGrid from "./components/StatsGrid.tsx";
import ChartPanel from "./components/ChartPanel.tsx";
import QuickActions from "./components/QuickActions.tsx";
import DeliveriesTable from "./components/DeliveriesTable.tsx";
import NewDeliveryDialog, { type NewDeliveryData } from "./components/NewDeliveryDialog.tsx";
import { INITIAL_DELIVERIES, STATUS_LABEL, type Delivery } from "./delivery.ts";

function saudacao(agora: Date): string {
  const hora = agora.getHours();
  if (hora < 12) return "Bom dia!";
  if (hora < 18) return "Boa tarde!";
  return "Boa noite!";
}

export default function App() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(INITIAL_DELIVERIES);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState({ message: "", visible: false });
  const toastTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string) => {
    setToast({ message, visible: true });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 3200);
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return deliveries;
    return deliveries.filter((d) =>
      `${d.id} nf-e ${d.invoice} ${d.recipient} ${d.date} ${STATUS_LABEL[d.status]}`
        .toLocaleLowerCase("pt-BR")
        .includes(term)
    );
  }, [deliveries, search]);

  const handleSave = (data: NewDeliveryData) => {
    const data_formatada = new Date(`${data.date}T12:00:00`)
      .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      .replace(".", "");
    setDeliveries((prev) => {
      const ultimo = prev.reduce((max, d) => Math.max(max, Number(d.id.slice(3))), 1048);
      const nova: Delivery = {
        id: `EP-${ultimo + 1}`,
        invoice: data.invoice,
        recipient: data.recipient,
        date: data_formatada,
        status: "aguardando",
      };
      return [nova, ...prev];
    });
    setDialogOpen(false);
    notify("Entrega registrada com sucesso! (demonstração local)");
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      notify(`Arquivo selecionado: ${file.name}. O envio real precisa de backend.`);
    }
    event.target.value = "";
  };

  const handleReview = () => {
    document.getElementById("entregas")?.scrollIntoView({ behavior: "smooth" });
    setSearch("Pendência");
    notify("Filtrando entregas com pendências.");
  };

  const handleExport = () => {
    const linhas: string[][] = [
      ["ENTREGA / NOTA FISCAL", "DESTINATÁRIO", "DATA", "STATUS"],
      ...visible.map((d) => [`#${d.id} NF-e ${d.invoice}`, d.recipient, d.date, STATUS_LABEL[d.status]]),
    ];
    const csv = linhas
      .map((colunas) => colunas.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "entregaprova-entregas.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Arquivo CSV exportado.");
  };

  const agora = new Date();
  const dataExtenso = agora
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .toLocaleUpperCase("pt-BR");

  return (
    <>
      <Sidebar onHelp={() => notify("Canal de suporte demonstrativo — conecte aqui seu atendimento.")} />

      <main className="main">
        <TopBar onNotifications={() => notify("Você está em dia com as notificações de demonstração.")} />

        <section className="welcome">
          <div>
            <p className="eyebrow">{dataExtenso}</p>
            <h1>{saudacao(agora)} 👋</h1>
            <p className="muted">Aqui está um resumo da operação da sua transportadora.</p>
          </div>
          <button type="button" className="button primary" onClick={() => setDialogOpen(true)}>
            <span>＋</span> Registrar entrega
          </button>
        </section>

        <StatsGrid />

        <section className="content-grid">
          <ChartPanel onPeriod={() => notify("Gráfico demonstrativo: os dados são fictícios.")} />
          <QuickActions
            onUpload={() => fileInput.current?.click()}
            onReview={handleReview}
            onReport={() =>
              notify("Demonstração: o pacote de faturamento seria preparado com os comprovantes validados.")
            }
          />
        </section>

        <DeliveriesTable
          visible={visible}
          total={deliveries.length}
          search={search}
          onSearch={setSearch}
          onExport={handleExport}
          onViewAll={() => {
            setSearch("");
            notify("Todas as entregas de demonstração estão exibidas.");
          }}
          onDetails={() => notify("Detalhes da entrega — esta é uma interface demonstrativa.")}
        />

        <footer>© 2026 EntregaProva · Da entrega à comprovação, sem perder o controle.</footer>
      </main>

      <div className={`toast${toast.visible ? " show" : ""}`} role="status" aria-live="polite">
        {toast.message}
      </div>

      <NewDeliveryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={handleSave} />
      <input ref={fileInput} type="file" accept="image/*,.pdf" hidden onChange={handleFile} />
    </>
  );
}
