import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const emulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL ?? import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
const useAuthEmulator = import.meta.env.VITE_USE_EMULATORS !== "false" && Boolean(emulatorUrl);
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (!useAuthEmulator && !apiKey) {
  throw new Error("VITE_FIREBASE_API_KEY precisa estar configurada fora do emulador.");
}

const app = initializeApp({
  apiKey: apiKey ?? "chave-local-do-emulador",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-entregaprova",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
});

export const auth = getAuth(app);

// Nesta fase tudo roda no emulador: não existe login real na nuvem.
if (useAuthEmulator && emulatorUrl) {
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
}
