interface Stat {
  icon: string;
  iconClass: string;
  trend: string;
  trendClass: string;
  label: string;
  value: string;
  foot: string;
}

// Números de demonstração. Virão da API quando ela existir.
const STATS: Stat[] = [
  { icon: "▣", iconClass: "blue-bg", trend: "↗ 12,8%", trendClass: "positive", label: "Entregas no período", value: "1.284", foot: "Em relação ao mês passado" },
  { icon: "✓", iconClass: "green-bg", trend: "↗ 8,4%", trendClass: "positive", label: "Comprovadas", value: "1.126", foot: "87,7% das entregas" },
  { icon: "◷", iconClass: "yellow-bg", trend: "Atenção", trendClass: "neutral", label: "Aguardando comprovante", value: "128", foot: "Precisam de acompanhamento" },
  { icon: "!", iconClass: "red-bg", trend: "Prioridade", trendClass: "danger", label: "Com pendências", value: "30", foot: "Documentos para revisar" },
];

export default function StatsGrid() {
  return (
    <section className="stats-grid" aria-label="Indicadores">
      {STATS.map((s) => (
        <article className="stat-card" key={s.label}>
          <div className="stat-top">
            <span className={`stat-icon ${s.iconClass}`}>{s.icon}</span>
            <span className={`trend ${s.trendClass}`}>{s.trend}</span>
          </div>
          <p className="stat-label">{s.label}</p>
          <div className="stat-value">{s.value}</div>
          <p className="stat-foot">{s.foot}</p>
        </article>
      ))}
    </section>
  );
}
