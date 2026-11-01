import * as admin from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccount = serviceAccountJson ? JSON.parse(serviceAccountJson) : undefined;

const projectId =
  serviceAccount?.project_id || process.env.GCP_PROJECT_ID || "demo-entregaprova";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
    ...(serviceAccount && { credential: admin.credential.cert(serviceAccount) }),
    storageBucket:
      process.env.STORAGE_BUCKET ||
      process.env.STORAGE_BUCKET_NAME ||
      `${projectId}.appspot.com`,
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();