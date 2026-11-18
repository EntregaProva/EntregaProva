export function readFirebaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const emulatorKeys = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST"];
  if (production && emulatorKeys.some(key => env[key])) {
    throw new Error("Produção não pode usar emuladores");
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Use ADC com GOOGLE_APPLICATION_CREDENTIALS; não passe credenciais em FIREBASE_SERVICE_ACCOUNT_JSON");
  }
  const projectId = env.FIREBASE_PROJECT_ID || env.GCP_PROJECT_ID || env.GCLOUD_PROJECT || (production ? undefined : "demo-entregaprova");
  if (!projectId || (production && projectId.startsWith("demo-"))) {
    throw new Error("Configure FIREBASE_PROJECT_ID válido para produção");
  }
  // Production files live in Supabase; a Firebase bucket is only needed locally.
  return production ? { projectId } : {
    projectId, storageBucket: env.STORAGE_BUCKET || env.STORAGE_BUCKET_NAME || `${projectId}.appspot.com`,
  };
}

export function readProofStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const provider = env.PROOF_STORAGE_PROVIDER || (production ? "supabase" : "firebase-emulator");
  if (provider === "firebase-emulator" && !production && env.FIREBASE_STORAGE_EMULATOR_HOST) {
    return { provider } as const;
  }
  if (provider !== "supabase") throw new Error("Use Supabase em produção ou configure o emulador de Storage local");
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey, SUPABASE_STORAGE_BUCKET: bucket } = env;
  let validUrl = false;
  try {
    const parsed = new URL(url!);
    validUrl = parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch { /* Report configuration keys only, never their values. */ }
  if (!validUrl || !secretKey || !bucket || !/^[A-Za-z0-9_-]+$/.test(bucket)) {
    throw new Error("Configure SUPABASE_URL (HTTPS), SUPABASE_SECRET_KEY e SUPABASE_STORAGE_BUCKET");
  }
  return { provider: "supabase", url: url!, secretKey, bucket } as const;
}
