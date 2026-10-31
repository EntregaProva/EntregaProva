import { apiFetch } from "./client.ts";

// ============================================================================
// CONTRATO ASSUMIDO — confirme cada item no OpenAPI v0.1 do backend e ajuste
// aqui (nomes de campos, caminhos, formato do corpo). As telas só dependem
// deste arquivo e do tipo Delivery.
// ============================================================================

export interface Delivery {
  id: string;
  invoiceNumber: string; // número da NF-e / CT-e
  accessKey: string; // chave de acesso (44 dígitos)
  recipient: string;
  status: string; // valores esperados: veja src/status.ts
  createdAt: string; // data/hora em formato ISO
}

// GET /deliveries  ->  Delivery[]
export function listDeliveries(): Promise<Delivery[]> {
  return apiFetch<Delivery[]>("/deliveries");
}

// POST /deliveries/import-xml  (multipart: campo "file")  ->  Delivery
export function importXml(file: File): Promise<Delivery> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<Delivery>("/deliveries/import-xml", { method: "POST", body });
}

export interface ProofInput {
  deliveryId: string;
  photo: File;
  receiverName: string;
  capturedAt: string; // ISO
  idempotencyKey: string; // mesma chave no reenvio => o backend não duplica
}

// POST /deliveries/{id}/proof  (multipart)  ->  Delivery
export function sendProof(input: ProofInput): Promise<Delivery> {
  const body = new FormData();
  body.append("photo", input.photo);
  body.append("receiverName", input.receiverName);
  body.append("capturedAt", input.capturedAt);
  return apiFetch<Delivery>(`/deliveries/${encodeURIComponent(input.deliveryId)}/proof`, {
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
  xml: { invoiceNumber: string; accessKey: string; recipient: string; };
  proof: { photoUrl: string; receiverName: string; capturedAt: string; };
}

// GET /deliveries/review -> documentos pendentes de conferência.
export function listReviewQueue(): Promise<ReviewItem[]> {
  return apiFetch<ReviewItem[]>("/deliveries/review");
}

export type ReviewDecision = "approved" | "rejected";

// POST /deliveries/{id}/review -> { decision, reason? }.
export function submitReview(input: { deliveryId: string; decision: ReviewDecision; reason?: string }): Promise<void> {
  return apiFetch<void>(`/deliveries/${encodeURIComponent(input.deliveryId)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: input.decision, reason: input.reason }),
  });
}
