import { createClient } from "@supabase/supabase-js";
import { createEmulatorProofStorage, createSupabaseProofStorage } from "../services/proof-storage.js";
import { readProofStorageConfig } from "./runtime.js";
import { MAX_PROOF_BYTES, PROOF_MIME_TYPES } from "./proof.js";

export async function createRuntimeProofStorage() {
  const config = readProofStorageConfig();
  if (config.provider === "firebase-emulator") {
    const { storage } = await import("./firebase.js");
    return createEmulatorProofStorage(storage);
  }
  const client = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
  const { data, error } = await client.storage.getBucket(config.bucket);
  if (error || !data || data.public || data.file_size_limit !== MAX_PROOF_BYTES ||
      !data.allowed_mime_types || data.allowed_mime_types.length !== PROOF_MIME_TYPES.length ||
      PROOF_MIME_TYPES.some(mime => !data.allowed_mime_types!.includes(mime))) {
    throw new Error("Bucket Supabase deve existir, ser privado, limitar arquivos a 300000 bytes e restringir os tipos permitidos");
  }
  return createSupabaseProofStorage(client, config.bucket);
}
