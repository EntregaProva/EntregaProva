/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_PREFIX: string;
  readonly VITE_API_PREFIX: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL: string;
  readonly VITE_AUTH_EMULATOR_URL: string;
  readonly VITE_USE_EMULATORS: string;
  readonly VITE_AUTH_EMULATOR_URL: string;
  readonly VITE_USE_EMULATORS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
