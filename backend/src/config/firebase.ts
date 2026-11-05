import * as admin from "firebase-admin";
import { readFirebaseConfig } from "./runtime.js";

if (!admin.apps.length) {
  // ADC uses the Cloud Run service identity; emulators need no real key.
  admin.initializeApp(readFirebaseConfig());
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
