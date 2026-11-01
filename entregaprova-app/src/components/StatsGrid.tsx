import type { Delivery } from "../api/deliveries.ts";

// Números calculados a partir das entregas REAIS que vieram da API.
export default function StatsGrid({ deliveries }: { deliveries: Delivery[] }) {
  const contar = (...status: string[]) => deliveries.filter((d) => status.includes(d.status)).length;

  const cards = [
    { icon: "▣", cor: "blue-bg", label: "Total de entregas", valor: deliveries.length, nota: "Importadas até agora" },
    { icon: "✓", cor: "green-bg", label: "Conferidas", valor: contar("conferida"), nota: "Comprovante validado" },
    { icon: "◷", cor: "yellow-bg", label: "Aguardando", valor: contar("pendente", "capturada"), nota: "Precisam de acompanhamento" },
    { icon: "!", cor: "red-bg", label: "Diferentes", valor: contar("diferente"), nota: "Documentos para revisar" },
  ];

  return (
    <section className="stats-grid" aria-label="Indicadores">
      {cards.map((c) => (
        <article className="stat-card" key={c.label}>
          <div className="stat-top">
            <span className={`stat-icon ${c.cor}`} aria-hidden="true">{c.icon}</span>
          </div>
          <p className="stat-label">{c.label}</p>
          <div className="stat-value">{c.valor}</div>
          <p className="stat-foot">{c.nota}</p>
        </article>
      ))}
    </section>
  );
}
