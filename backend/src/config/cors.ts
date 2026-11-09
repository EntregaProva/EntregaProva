import type { CorsOptions } from "cors";
import { HttpError } from "../utils/httpError.js";

export function createCorsOptions(origins: string[], hostingSite?: string): CorsOptions {
  const allowed = new Set(origins);
  if (hostingSite && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(hostingSite)) throw new Error("CORS_HOSTING_SITE inválido");
  // Explicit opt-in for this site's PR channels, never arbitrary *.web.app.
  const preview = hostingSite ? new RegExp(`^https://${hostingSite}--pr-[0-9]+-[a-z0-9]+\\.web\\.app$`) : undefined;
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin) || preview?.test(origin)) return callback(null, true);
      callback(new HttpError(403, "Origem não permitida"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  };
}
