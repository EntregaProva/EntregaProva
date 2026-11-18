import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const emulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL ?? import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
const emulatorRequested = import.meta.env.VITE_USE_EMULATORS === "true" ||
  (!import.meta.env.VITE_USE_EMULATORS && Boolean(emulatorUrl));
const useAuthEmulator = emulatorRequested && Boolean(emulatorUrl);
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-entregaprova";

// Keep the app renderable when deployment config is missing so the login can
// explain the problem instead of crashing into a blank page.
export const firebaseConfigError = emulatorRequested && !emulatorUrl
  ? "Firebase Auth Emulator foi solicitado, mas VITE_AUTH_EMULATOR_URL não foi configurada."
  : !emulatorRequested && !apiKey
    ? "Firebase Web não configurado: informe VITE_FIREBASE_API_KEY no ambiente de build."
    : null;

const app = initializeApp({
  apiKey: apiKey ?? "emulator-placeholder-key",
  projectId,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
});

export const auth = getAuth(app);
export const usingAuthEmulator = useAuthEmulator;

// Nesta fase tudo roda no emulador: não existe login real na nuvem.
if (useAuthEmulator && emulatorUrl) {
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
}
