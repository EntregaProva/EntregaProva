import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

export interface AppDependencies {
  auth: {
    verifyIdToken(token: string): Promise<{ uid: string; tenantId?: unknown; role?: unknown }>;
  };
  db: Pick<Firestore, "doc" | "runTransaction">;
  storage: Pick<Storage, "bucket">;
  logger: {
    info(fields: Record<string, unknown>): void;
    error(fields: Record<string, unknown>): void;
  };
}
