import { apiFetch } from "./client.ts";

export type DeliveryStatus = "PENDENTE" | "COMPROVADO" | "CONFERIDO" | "REJEITADO";

export interface Proof {
  photoUrl: string;
  receiverName: string;
  capturedAt: string;
  expiresAt?: string;
}

export interface Delivery {
  id: string;
  invoiceNumber: string;
  accessKey: string;
  recipient: string;
  status: DeliveryStatus | string;
  createdAt: string;
  proof?: Proof;
}

interface BackendProof {
  arquivoDisponivel?: boolean;
  arquivoUrl?: string | null;
  expiraEm?: string | null;
  recebedorNome?: string;
  dataHoraEntrega?: string;
}

interface BackendDelivery {
  id?: string;
  numeroNF?: string;
  chaveNFe?: string;
  destinatario?: string;
  status?: string;
  criadoEm?: string;
  comprovante?: BackendProof;
}

function adaptDelivery(raw: BackendDelivery): Delivery {
  const proof = raw.comprovante;
  return {
    id: raw.id ?? raw.chaveNFe ?? "",
    invoiceNumber: raw.numeroNF ?? "",
    accessKey: raw.chaveNFe ?? "",
    recipient: raw.destinatario ?? "",
    status: raw.status ?? "PENDENTE",
    createdAt: raw.criadoEm ?? "",
    ...(proof?.arquivoDisponivel !== false && proof?.arquivoUrl ? {
      proof: {
        photoUrl: proof.arquivoUrl,
        receiverName: proof.recebedorNome ?? "",
        capturedAt: proof.dataHoraEntrega ?? "",
        expiresAt: proof.expiraEm ?? undefined,
      },
    } : {}),
  };
}

export async function listDeliveries(cursor: string | null, status?: DeliveryStatus) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (status) params.set("status", status);
  const query = params.toString();
  const page = await apiFetch<{ itens: BackendDelivery[]; proximoCursor: string | null }>(
    query ? `/deliveries?${query}` : "/deliveries",
  );
  return { items: page.itens.map(adaptDelivery), nextCursor: page.proximoCursor };
}

export async function getDelivery(id: string): Promise<Delivery> {
  const raw = await apiFetch<BackendDelivery>(`/deliveries/${encodeURIComponent(id)}`);
  return adaptDelivery(raw);
}

export async function importXml(file: File, driverId: string): Promise<Delivery> {
  const xmlContent = await file.text();
  const raw = await apiFetch<BackendDelivery>("/deliveries/xml", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xmlContent, driverId }),
  });
  return adaptDelivery(raw);
}

export interface ProofInput {
  deliveryId: string;
  photo: File;
  receiverName: string;
  capturedAt: string;
  idempotencyKey: string;
}

export interface ProofSubmissionResult {
  id: string;
  status: DeliveryStatus;
  message: string;
  comprovante: BackendProof;
}

export function sendProof(input: ProofInput): Promise<ProofSubmissionResult> {
  const body = new FormData();
  body.append("file", input.photo);
  body.append("recebedorNome", input.receiverName);
  body.append("dataHoraEntrega", input.capturedAt);
  return apiFetch<ProofSubmissionResult>(`/deliveries/${encodeURIComponent(input.deliveryId)}/proof`, {
    method: "POST",
    body,
    headers: { "Idempotency-Key": input.idempotencyKey },
  });
}

export type ReviewDecision = "approved" | "rejected";

export function submitReview(input: { deliveryId: string; decision: ReviewDecision; reason?: string }): Promise<void> {
  return apiFetch<void>(`/deliveries/${encodeURIComponent(input.deliveryId)}/check`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aprovado: input.decision === "approved",
      ...(input.decision === "rejected" ? { motivoRejeicao: input.reason } : {}),
    }),
  });
}
