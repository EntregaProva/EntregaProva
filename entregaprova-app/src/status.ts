
export interface StatusInfo {
  label: string;
  icon: string;
  css: string; // classe do style.css
}

const STATUS: Record<string, StatusInfo> = {
  PENDENTE: { label: "Pendente", icon: "◷", css: "warning" },
  COMPROVADO: { label: "Aguardando conferência", icon: "◔", css: "warning" },
  CONFERIDO: { label: "Conferida", icon: "✓", css: "success" },
  REJEITADO: { label: "Rejeitada", icon: "!", css: "danger-status" },
};

export function infoDoStatus(status: string): StatusInfo {
  return STATUS[status.toUpperCase()] ?? { label: status, icon: "•", css: "warning" };
}
