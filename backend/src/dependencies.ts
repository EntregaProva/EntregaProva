import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

export interface AppDependencies {
  auth: {
    verifyIdToken(token: string): Promise<{ uid: string; tenantId?: unknown; role?: unknown }>;
  };
  db: Pick<Firestore, "doc" | "collection" |"runTransaction">;
  storage: Pick<Storage, "bucket">;
  // Optional test seam: emulator integration exercises real upload without a cloud signing key.
  proofUrlSigner?: (path: string, expires: number) => Promise<string>;
  logger: {
    info(fields: Record<string, unknown>): void;
    error(fields: Record<string, unknown>): void;
  };
}
