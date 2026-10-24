export type DeliveryStatus = "comprovada" | "aguardando" | "pendencia";

export interface Delivery {
  id: string; // ex.: "EP-1048"
  invoice: string; // número da NF-e / CT-e
  recipient: string;
  date: string;
  status: DeliveryStatus;
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  comprovada: "Comprovada",
  aguardando: "Aguardando",
  pendencia: "Pendência",
};

export const STATUS_CLASS: Record<DeliveryStatus, string> = {
  comprovada: "success",
  aguardando: "warning",
  pendencia: "danger-status",
};

// Dados de demonstração. Serão trocados pelos dados reais vindos da API.
export const INITIAL_DELIVERIES: Delivery[] = [
  { id: "EP-1048", invoice: "35291", recipient: "Mercado Central", date: "15 out, 14:32", status: "comprovada" },
  { id: "EP-1047", invoice: "35290", recipient: "Distribuidora Horizonte", date: "15 out, 13:18", status: "aguardando" },
  { id: "EP-1046", invoice: "35289", recipient: "Supermercado Bom Dia", date: "15 out, 11:45", status: "pendencia" },
  { id: "EP-1045", invoice: "35288", recipient: "Armazém do Vale", date: "14 out, 17:06", status: "comprovada" },
  { id: "EP-1044", invoice: "35287", recipient: "Comercial São Lucas", date: "14 out, 15:51", status: "aguardando" },
];
