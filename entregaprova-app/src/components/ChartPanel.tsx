interface Bar {
  day: string;
  paid: number; // altura da barra azul (%)
  pending: number; // altura da barra clara (%)
}

const BARS: Bar[] = [
  { day: "Seg", paid: 66, pending: 22 },
  { day: "Ter", paid: 82, pending: 17 },
  { day: "Qua", paid: 72, pending: 26 },
  { day: "Qui", paid: 92, pending: 15 },
  { day: "Sex", paid: 78, pending: 28 },
  { day: "Sáb", paid: 56, pending: 19 },
  { day: "Dom", paid: 45, pending: 12 },
];

const Y_LABELS = ["200", "150", "100", "50", "0"];

interface ChartPanelProps {
  onPeriod: () => void;
}

export default function ChartPanel({ onPeriod }: ChartPanelProps) {
  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Visão das comprovações</h2>
          <p className="muted">Acompanhamento dos últimos 7 dias</p>
        </div>
        <button type="button" className="select-like" onClick={onPeriod}>
          Últimos 7 dias⌄
        </button>
      </div>
      <div className="chart-legend">
        <span><i className="legend-blue"></i>Comprovadas</span>
        <span><i className="legend-light"></i>Pendentes</span>
      </div>
      <div className="chart" aria-label="Gráfico demonstrativo de comprovações">
        <div className="y-labels">
          {Y_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="chart-area">
          <div className="gridline g1"></div>
          <div className="gridline g2"></div>
          <div className="gridline g3"></div>
          <div className="gridline g4"></div>
          <div className="bars">
            {BARS.map((b) => (
              <div className="bar-group" key={b.day}>
                <div className="bar blue-bar" style={{ height: `${b.paid}%` }}></div>
                <div className="bar pale-bar" style={{ height: `${b.pending}%` }}></div>
                <small>{b.day}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
