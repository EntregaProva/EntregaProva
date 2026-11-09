import * as admin from "firebase-admin";
import { readFirebaseConfig } from "./runtime.js";

if (!admin.apps.length) {
  // Render: ADC reads GOOGLE_APPLICATION_CREDENTIALS from a mounted secret file.
  // Local emulators need no real key.
  admin.initializeApp(readFirebaseConfig());
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
