import { useDeliveryPages } from "../hooks/useDeliveryPages.ts";
import DeliveryPagination from "../components/DeliveryPagination.tsx";
import StateMessage from "../components/StateMessage.tsx";
import StatsGrid from "../components/StatsGrid.tsx";
import DeliveriesTable from "../components/DeliveriesTable.tsx";
import type { View } from "../views.ts";

export default function DeliveriesPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { data, error, loading, reload, pagination } = useDeliveryPages();

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">ENTREGAS</p>
          <h1>Entregas e comprovantes</h1>
          <p className="muted">Veja o que já foi importado e o que ainda precisa de comprovante.</p>
        </div>
        <button type="button" className="button primary" onClick={() => onNavigate("importar")}>
          <span aria-hidden="true">＋</span> Importar XML
        </button>
      </section>

      {loading && <StateMessage kind="loading" message="Carregando entregas..." />}
      {!loading && error && <StateMessage kind="error" message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <StateMessage
          kind="empty"
          message={pagination.previous ? "Nenhuma entrega nesta página." : "Nenhuma entrega ainda. Importe um XML de NF-e 4.00 para criar a primeira."}
          actionLabel="Importar XML"
          onAction={() => onNavigate("importar")}
        />
      )}
      {!loading && !error && data && data.length > 0 && (
        <>
          <StatsGrid deliveries={data} />
          <DeliveriesTable deliveries={data} />
        </>
      )}
      <DeliveryPagination {...pagination} disabled={loading} />
    </>
  );
}
