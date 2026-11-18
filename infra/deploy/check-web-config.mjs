import { pathToFileURL } from "node:url";

export function checkWebConfig(env = process.env) {
  if (!env.VITE_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID.startsWith("demo-") || !env.VITE_FIREBASE_API_KEY) {
    throw new Error("Configure FIREBASE_PROJECT_ID e VITE_FIREBASE_API_KEY nas Variables do GitHub");
  }
  const api = new URL(env.VITE_API_URL);
  if (api.protocol !== "https:" || api.username || api.password || api.pathname !== "/" || api.search || api.hash) {
    throw new Error("API_BASE_URL deve ser a origem HTTPS pública da API Render");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) checkWebConfig();
