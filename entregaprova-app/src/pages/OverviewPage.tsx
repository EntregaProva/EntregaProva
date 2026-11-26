import { useMemo } from "react";
import type { Delivery } from "../api/deliveries.ts";
import Icon, { type IconName } from "../components/Icon.tsx";
import StateMessage from "../components/StateMessage.tsx";
import { useAuth } from "../auth/useAuth.ts";
import { useDeliveryPages } from "../hooks/useDeliveryPages.ts";
import { formatarDataHora } from "../format.ts";
import { infoDoStatus } from "../status.ts";
import type { View } from "../views.ts";
import "./OverviewPage.css";

type Action = { view: View; title: string; description: string; icon: IconName };

function resumoDasEntregas(deliveries: Delivery[]) {
  return {
    total: deliveries.length,
    pendentes: deliveries.filter((delivery) => delivery.status === "PENDENTE" || delivery.status === "REJEITADO").length,
    conferencia: deliveries.filter((delivery) => delivery.status === "COMPROVADO").length,
    concluidas: deliveries.filter((delivery) => delivery.status === "CONFERIDO").length,
  };
}

function acoesParaPapel(role: "admin" | "operator" | "driver", resumo: ReturnType<typeof resumoDasEntregas>): Action[] {
  if (role === "driver") {
    return [
      { view: "capturar", title: "Registrar comprovante", description: resumo.pendentes ? `${resumo.pendentes} entrega(s) precisam de foto nesta página.` : "Envie a foto e os dados de recebimento." , icon: "camera" },
      { view: "entregas", title: "Ver minhas entregas", description: "Consulte o status das entregas atribuídas a você.", icon: "deliveries" },
    ];
  }
  return [
    { view: "importar", title: "Importar NF-e", description: "Envie um XML e prepare novas entregas.", icon: "document" },
    { view: "conferir", title: "Conferir comprovantes", description: resumo.conferencia ? `${resumo.conferencia} comprovante(s) aguardam conferência nesta página.` : "Revise os comprovantes recebidos.", icon: "review" },
  ];
}

function resumoDeStatus(deliveries: Delivery[]) {
  return [
    { label: "Entregas nesta página", value: deliveries.length, icon: "deliveries" as const, tone: "blue" },
    { label: "Aguardando comprovante", value: deliveries.filter((item) => item.status === "PENDENTE" || item.status === "REJEITADO").length, icon: "camera" as const, tone: "amber" },
    { label: "Aguardando conferência", value: deliveries.filter((item) => item.status === "COMPROVADO").length, icon: "review" as const, tone: "violet" },
    { label: "Conferidas", value: deliveries.filter((item) => item.status === "CONFERIDO").length, icon: "check" as const, tone: "green" },
  ];
}

function RecentDelivery({ delivery }: { delivery: Delivery }) {
  const status = infoDoStatus(delivery.status);
  return (
    <li className="overview-delivery">
      <span className={`overview-delivery-icon ${status.css}`} aria-hidden="true"><Icon name="document" size={18} /></span>
      <span className="overview-delivery-main">
        <strong>NF-e {delivery.invoiceNumber || "—"}</strong>
        <small>{delivery.recipient || "Destinatário não informado"}</small>
      </span>
      <span className={`status ${status.css}`}>{status.label}</span>
      <time dateTime={delivery.createdAt}>{formatarDataHora(delivery.createdAt)}</time>
    </li>
  );
}

export default function OverviewPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { role, user } = useAuth();
  const { data, error, loading, reload } = useDeliveryPages();
  const deliveries = useMemo(() => data ?? [], [data]);
  const resumo = useMemo(() => resumoDasEntregas(deliveries), [deliveries]);
  const metrics = useMemo(() => resumoDeStatus(deliveries), [deliveries]);
  if (!role) return null;

  const actions = acoesParaPapel(role, resumo);
  const mainAction = role === "driver"
    ? (resumo.pendentes ? actions[0] : actions[1])
    : (resumo.conferencia ? actions[1] : actions[0]);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <div className="overview-page">
      <section className="overview-welcome">
        <div className="overview-welcome-copy">
          <p className="overview-kicker">PAINEL DA OPERAÇÃO</p>
          <h1>{firstName ? `Olá, ${firstName}` : "Visão geral"}</h1>
          <p>Acompanhe cada entrega e encontre a próxima etapa da sua rotina.</p>
        </div>
        <button type="button" className="overview-welcome-action" onClick={() => onNavigate(mainAction.view)}>
          {role === "driver" ? "Continuar minhas entregas" : resumo.conferencia ? "Conferir comprovantes" : "Importar NF-e"}
          <Icon name="arrow" size={18} />
        </button>
        <div className="overview-welcome-mark" aria-hidden="true"><Icon name="route" size={116} /></div>
      </section>

      <section className="overview-metrics" aria-label="Resumo da página de entregas carregada">
        {metrics.map((metric) => (
          <article className="overview-metric" key={metric.label}>
            <span className={`overview-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={19} /></span>
            <div><p>{metric.label}</p><strong>{loading ? "—" : metric.value}</strong></div>
          </article>
        ))}
        <p className="overview-metric-note">Os indicadores refletem os registros da página carregada.</p>
      </section>

      <div className="overview-content-grid">
        <section className="overview-panel overview-recent-panel" aria-labelledby="overview-recent-title">
          <header className="overview-panel-head">
            <div><p className="overview-eyebrow">MOVIMENTAÇÃO</p><h2 id="overview-recent-title">Entregas recentes</h2></div>
            <button type="button" className="overview-subtle-button" onClick={() => onNavigate("entregas")}>Ver lista completa <Icon name="arrow" size={16} /></button>
          </header>
          {loading && <StateMessage kind="loading" message="Carregando suas entregas..." />}
          {!loading && error && <StateMessage kind="error" message={error} onRetry={reload} />}
          {!loading && !error && deliveries.length === 0 && (
            <div className="overview-empty">
              <span><Icon name="document" size={23} /></span>
              <div><strong>Nenhuma entrega para mostrar</strong><p>Quando uma entrega for importada ou atribuída, ela aparecerá aqui.</p></div>
            </div>
          )}
          {!loading && !error && deliveries.length > 0 && (
            <ul className="overview-delivery-list">
              {deliveries.slice(0, 5).map((delivery) => <RecentDelivery key={delivery.id} delivery={delivery} />)}
            </ul>
          )}
        </section>

        <aside className="overview-panel overview-actions-panel" aria-labelledby="overview-actions-title">
          <header className="overview-panel-head">
            <div><p className="overview-eyebrow">PRÓXIMA ETAPA</p><h2 id="overview-actions-title">Ações da sua rotina</h2></div>
          </header>
          <button type="button" className="overview-primary-action" onClick={() => onNavigate(mainAction.view)}>
            <span className="overview-action-icon"><Icon name={mainAction.icon} size={20} /></span>
            <span><strong>{mainAction.title}</strong><small>{mainAction.description}</small></span>
            <Icon className="overview-action-arrow" name="arrow" size={17} />
          </button>
          <div className="overview-secondary-actions">
            {actions.filter((action) => action.view !== mainAction.view).map((action) => (
              <button type="button" key={action.view} onClick={() => onNavigate(action.view)}>
                <Icon name={action.icon} size={17} /><span>{action.title}</span><Icon className="overview-action-arrow" name="arrow" size={15} />
              </button>
            ))}
          </div>
          <div className="overview-flow-note"><Icon name="route" size={18} /><p><strong>Do documento à conferência</strong><span>As etapas ficam conectadas ao registro da entrega.</span></p></div>
        </aside>
      </div>
    </div>
  );
}
