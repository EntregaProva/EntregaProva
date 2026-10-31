
export interface StatusInfo {
  label: string;
  icon: string;
  css: string; // classe do style.css
}

const STATUS: Record<string, StatusInfo> = {
  pendente: { label: "Pendente", icon: "◷", css: "warning" },
  capturada: { label: "Aguardando conferência", icon: "◔", css: "warning" },
  conferida: { label: "Conferida", icon: "✓", css: "success" },
  divergente: { label: "Diferente", icon: "!", css: "danger-status" },
};

export function infoDoStatus(status: string): StatusInfo {
  return STATUS[status] ?? { label: status, icon: "•", css: "warning" };
}
