import {
  FieldPath,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import type { AppDependencies } from "../dependencies.js";
import type {
  AuthenticatedUser,
} from "../middlewares/auth.middleware.js";

import { HttpError } from "../utils/httpError.js";

const VALID_STATUSES = [
  "PENDENTE",
  "COMPROVADO",
  "CONFERIDO",
  "REJEITADO",
];

function optionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} inválido`);
  }

  return value;
}

function parseFilters(input: Record<string, unknown>) {
  // Identidade e empresa não são filtros escolhidos pelo cliente.
  if (
    input.tenantId !== undefined ||
    input.driverId !== undefined
  ) {
    throw new HttpError(
      400,
      "Tenant e motorista são definidos pela autenticação",
    );
  }

  const rawLimit = optionalString(input.limit, "limit");
  const cursor = optionalString(input.cursor, "cursor");
  const status = optionalString(input.status, "status");

  if (rawLimit !== undefined && !/^\d+$/.test(rawLimit)) {
    throw new HttpError(400, "limit deve ser um inteiro");
  }

  const limit = rawLimit === undefined
    ? 20
    : Number(rawLimit);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, "limit deve estar entre 1 e 100");
  }

  if (cursor !== undefined && !/^\d{44}$/.test(cursor)) {
    throw new HttpError(400, "cursor inválido");
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw new HttpError(400, "status inválido");
  }

  return { limit, cursor, status };
}

function toListItem(doc: QueryDocumentSnapshot) {
  const data = doc.data();

  // Lista explícita: não devolver uploadLease ou caminhos privados.
  return {
    id: doc.id,
    chaveNFe: data.chaveNFe,
    numeroNF: data.numeroNF,
    emitente: data.emitente ?? null,
    destinatario: data.destinatario,
    valorTotal: data.valorTotal,
    status: data.status,
    driverId: data.driverId ?? null,
    criadoEm: data.criadoEm,
  };
}

export async function listTenantDeliveries(
  deps: Pick<AppDependencies, "db">,
  user: AuthenticatedUser,
  input: Record<string, unknown>,
) {
  const { limit, cursor, status } = parseFilters(input);

  let query: Query = deps.db.collection(
    `tenants/${user.tenantId}/deliveries`,
  );

  if (user.role === "driver") {
    query = query.where("driverId", "==", user.uid);
  }

  if (status !== undefined) {
    query = query.where("status", "==", status);
  }

  query = query.orderBy(FieldPath.documentId());

  if (cursor !== undefined) {
    query = query.startAfter(cursor);
  }

  const snapshot = await query.limit(limit + 1).get();
  const visible = snapshot.docs.slice(0, limit);

  return {
    itens: visible.map(toListItem),
    proximoCursor:
      snapshot.docs.length > limit
        ? visible[visible.length - 1].id
        : null,
  };
}