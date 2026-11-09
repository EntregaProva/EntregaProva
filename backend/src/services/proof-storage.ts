import type { Storage } from "firebase-admin/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

const storageCode = (error: unknown): string | undefined => {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
};

export interface ProofStorage {
  uploadIfAbsent(path: string, bytes: Buffer, contentType: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  signedUrl(path: string, expires: number): Promise<string>;
}

// Firebase Storage is used only by the local emulators and their integration tests.
export function createEmulatorProofStorage(
  storage: Pick<Storage, "bucket">,
  signer?: ProofStorage["signedUrl"],
): ProofStorage {
  return {
    async uploadIfAbsent(path, bytes, contentType) {
      try {
        await storage.bucket().file(path).save(bytes, {
          resumable: false, metadata: { contentType }, preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (error) {
        if (Number((error as { code?: unknown }).code) !== 412) throw error;
      }
    },
    async exists(path) { return (await storage.bucket().file(path).exists())[0]; },
    async signedUrl(path, expires) {
      if (signer) return signer(path, expires);
      return (await storage.bucket().file(path).getSignedUrl({ version: "v4", action: "read", expires }))[0];
    },
  };
}

export function createSupabaseProofStorage(client: SupabaseClient, bucket: string): ProofStorage {
  const files = client.storage.from(bucket);
  return {
    async uploadIfAbsent(path, bytes, contentType) {
      const { error } = await files.upload(path, bytes, { contentType, upsert: false, cacheControl: "0" });
      // Only an actual duplicate may be reused after a lost upload response.
      if (error && !["Duplicate", "ResourceAlreadyExists"].includes(storageCode(error) ?? "")) throw error;
    },
    async exists(path) {
      // Do not confuse a failed credential or a missing bucket with a deleted photo.
      const { error } = await files.info(path);
      if (!error) return true;
      if (storageCode(error) === "NoSuchKey" || (error.status === 404 && !storageCode(error))) return false;
      throw error;
    },
    async signedUrl(path, expires) {
      const { data, error } = await files.createSignedUrl(path, Math.max(1, Math.floor((expires - Date.now()) / 1000)));
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Assinatura de comprovante indisponível");
      return data.signedUrl;
    },
  };
}
