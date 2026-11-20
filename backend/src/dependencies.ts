import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { ProofStorage } from "./services/proof-storage.js";

export interface AppDependencies {
  auth: Pick<Auth, "setCustomUserClaims" | "getUser" | "getUserByEmail"> & {
    verifyIdToken(token: string, checkRevoked?: boolean): Promise<{
      uid: string; tenantId?: unknown; role?: unknown; email_verified?: boolean; email?: string;
    }>;
  };
  db: Pick<Firestore, "doc" | "collection" |"runTransaction">;
  proofStorage: ProofStorage;
  logger: {
    info(fields: Record<string, unknown>): void;
    error(fields: Record<string, unknown>): void;
  };
}
