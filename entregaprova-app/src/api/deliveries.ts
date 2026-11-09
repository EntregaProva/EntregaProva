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
  arquivoUrl?: string;
  expiraEm?: string;
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
    ...(proof?.arquivoUrl ? {
      proof: {
        photoUrl: proof.arquivoUrl,
        receiverName: proof.recebedorNome ?? "",
        capturedAt: proof.dataHoraEntrega ?? "",
        expiresAt: proof.expiraEm,
      },
    } : {}),
  };
}

// BLOQUEIO DE CONTRATO: o backend ainda não implementa GET /deliveries.
// A rota e o formato da resposta da listagem precisam ser fechados com o backend.
export async function listDeliveries(): Promise<Delivery[]> {
  const raw = await apiFetch<BackendDelivery[]> ("/deliveries");
  return raw.map(adaptDelivery);
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

export interface ReviewItem {
  deliveryId: string;
  invoiceNumber: string;
  accessKey: string;
  recipient: string;
  xml: { invoiceNumber: string; accessKey: string; recipient: string };
  proof: Proof;
}

// BLOQUEIO DE CONTRATO: falta GET /deliveries/review. A resposta deve trazer
// IDs de 44 dígitos; a URL temporária vem da leitura autorizada de cada entrega.
export async function listReviewQueue(): Promise<ReviewItem[]> {
  const queue = await apiFetch<Array<BackendDelivery & { deliveryId?: string }>>("/deliveries/review");
  return Promise.all(queue.map(async (entry) => {
    const id = entry.id ?? entry.deliveryId ?? entry.chaveNFe ?? "";
    const detail = await apiFetch<BackendDelivery>(`/deliveries/${encodeURIComponent(id)}`);
    const adapted = adaptDelivery({ ...entry, ...detail, id });
    if (!adapted.proof?.photoUrl) throw new Error("A entrega não trouxe um comprovante disponível para leitura.");
    return {
      deliveryId: adapted.id,
      invoiceNumber: adapted.invoiceNumber,
      accessKey: adapted.accessKey,
      recipient: adapted.recipient,
      xml: { invoiceNumber: adapted.invoiceNumber, accessKey: adapted.accessKey, recipient: adapted.recipient },
      proof: adapted.proof,
    };
  }));
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
