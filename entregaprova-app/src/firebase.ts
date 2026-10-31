import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "chave-ficticia-do-emulador",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-entregaprova",
});

export const auth = getAuth(app);

// Nesta fase tudo roda no emulador: não existe login real na nuvem.
const emulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL ?? import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (import.meta.env.VITE_USE_EMULATORS !== "false" && emulatorUrl) {
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
}
