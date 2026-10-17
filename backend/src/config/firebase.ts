import * as admin from "firebase-admin";

const projectId = process.env.GCP_PROJECT_ID || "entregaprova-dev";

// Inicializa o Firebase Admin apontando para o projeto local
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId,
    storageBucket: process.env.STORAGE_BUCKET_NAME || `${projectId}.appspot.com`,
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
