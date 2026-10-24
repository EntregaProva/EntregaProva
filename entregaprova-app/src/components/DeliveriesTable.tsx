import { STATUS_CLASS, STATUS_LABEL, type Delivery } from "../delivery.ts";

interface DeliveriesTableProps {
  visible: Delivery[];
  total: number;
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  onViewAll: () => void;
  onDetails: (id: string) => void;
}

export default function DeliveriesTable({
  visible,
  total,
  search,
  onSearch,
  onExport,
  onViewAll,
  onDetails,
}: DeliveriesTableProps) {
  const contagem = search.trim()
    ? `Mostrando ${visible.length} de ${total} entrega(s)`
    : `Mostrando ${total} entregas recentes`;

  return (
    <section className="panel deliveries-panel" id="entregas">
      <div className="panel-heading deliveries-heading">
        <div>
          <h2>Entregas recentes</h2>
          <p className="muted">Acompanhe os comprovantes da sua operação.</p>
        </div>
        <div className="table-actions">
          <input
            type="search"
            placeholder="Buscar entrega..."
            aria-label="Buscar entrega"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          <button type="button" className="button secondary" onClick={onExport}>
            ↓ Exportar
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ENTREGA / NOTA FISCAL</th>
              <th>DESTINATÁRIO</th>
              <th>DATA</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  Nenhuma entrega encontrada. Tente outro termo de busca.
                </td>
              </tr>
            ) : (
              visible.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>#{d.id}</strong>
                    <small>NF-e {d.invoice}</small>
                  </td>
                  <td>{d.recipient}</td>
                  <td>{d.date}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[d.status]}`}>
                      <i></i>
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="more-btn"
                      aria-label={`Detalhes da entrega ${d.id}`}
                      onClick={() => onDetails(d.id)}
                    >
                      •••
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{contagem}</span>
        <a
          href="#entregas"
          onClick={(e) => {
            e.preventDefault();
            onViewAll();
          }}
        >
          Ver todas as entregas <span>→</span>
        </a>
      </div>
    </section>
  );
}
