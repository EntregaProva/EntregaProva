export function readFirebaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const emulatorKeys = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST"];
  if (production && emulatorKeys.some(key => env[key])) {
    throw new Error("Produção não pode usar emuladores");
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Use identidade de execução/ADC, sem chave JSON de conta de serviço");
  }
  const projectId = env.GCP_PROJECT_ID || env.GCLOUD_PROJECT || (production ? undefined : "demo-entregaprova");
  const storageBucket = env.STORAGE_BUCKET || env.STORAGE_BUCKET_NAME || (production ? undefined : `${projectId}.appspot.com`);
  if (!projectId || !storageBucket || (production && projectId.startsWith("demo-"))) {
    throw new Error("Configure GCP_PROJECT_ID e STORAGE_BUCKET válidos para produção");
  }
  return { projectId, storageBucket };
}
