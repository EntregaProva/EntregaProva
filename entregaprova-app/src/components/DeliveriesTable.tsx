import { useMemo, useState } from "react";
import type { Delivery } from "../api/deliveries.ts";
import { formatarDataHora } from "../format.ts";
import { infoDoStatus } from "../status.ts";

export default function DeliveriesTable({ deliveries }: { deliveries: Delivery[] }) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return deliveries;
    return deliveries.filter((d) =>
      `${d.invoiceNumber} ${d.accessKey} ${d.recipient} ${infoDoStatus(d.status).label}`
        .toLocaleLowerCase("pt-BR")
        .includes(termo)
    );
  }, [deliveries, busca]);

  return (
    <section className="panel deliveries-panel" id="entregas">
      <div className="panel-heading deliveries-heading">
        <div>
          <h2>Entregas</h2>
          <p className="muted">Acompanhe os comprovantes da sua operação.</p>
        </div>
        <div className="table-actions">
          <input
            type="search"
            placeholder="Buscar entrega..."
            aria-label="Buscar entrega"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NOTA FISCAL</th>
              <th>DESTINATÁRIO</th>
              <th>IMPORTADA EM</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-row">
                  Nenhuma entrega foi encontrada! Tente outro termo de busca.
                </td>
              </tr>
            ) : (
              visiveis.map((d) => {
                const st = infoDoStatus(d.status);
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>NF-e {d.invoiceNumber}</strong>
                      <small>Chave …{d.accessKey.slice(-8)}</small>
                    </td>
                    <td>{d.recipient}</td>
                    <td>{formatarDataHora(d.createdAt)}</td>
                    <td>
                      <span className={`status ${st.css}`}>
                        <span aria-hidden="true">{st.icon}</span>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          {busca.trim()
            ? `Mostrando ${visiveis.length} de ${deliveries.length} entrega(s)`
            : `${deliveries.length} entrega(s)`}
        </span>
      </div>
    </section>
  );
}
