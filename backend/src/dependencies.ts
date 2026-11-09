import type { Firestore } from "firebase-admin/firestore";
import type { ProofStorage } from "./services/proof-storage.js";

export interface AppDependencies {
  auth: {
    verifyIdToken(token: string): Promise<{ uid: string; tenantId?: unknown; role?: unknown }>;
  };
  db: Pick<Firestore, "doc" | "collection" |"runTransaction">;
  proofStorage: ProofStorage;
  logger: {
    info(fields: Record<string, unknown>): void;
    error(fields: Record<string, unknown>): void;
  };
}
