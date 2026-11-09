import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { MulterError } from "multer";
import { createRoutes } from "./routes/index.js";
import { getHealth } from "./controllers/health.controller.js";
import { AppDependencies } from "./dependencies.js";
import { HttpError } from "./utils/httpError.js";
import { createCorsOptions } from "./config/cors.js";

export function createApp(deps: AppDependencies) {
  const app = express();
  const routeTemplate = (req: express.Request): string => {
    const path = req.route?.path;
    // Aliases share a canonical template; never log the raw request URL.
    return Array.isArray(path) ? path[path.length - 1] : typeof path === "string" ? path : "unmatched";
  };
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader("X-Request-Id", requestId);
    res.locals.requestId = requestId;
    res.on("finish", () => deps.logger.info({
      severity: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARNING" : "INFO",
      event: "http_request", requestId, method: req.method,
      // Only route templates: no raw URL, query, headers, body or identity.
      route: routeTemplate(req), status: res.statusCode,
      durationMs: Date.now() - started,
      tenantId: req.user?.tenantId ?? null,
    }));
    next();
  });
  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map(value => value.trim()).filter(Boolean);
  app.use(cors(createCorsOptions(origins, process.env.CORS_HOSTING_SITE)));
  app.get("/healthz", getHealth);
  const ready = async (_req: express.Request, res: express.Response) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        deps.db.doc("_system/readiness").get(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("readiness timeout")), 2000);
        }),
      ]);
      res.status(200).json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    } finally {
      clearTimeout(timer);
    }
  };
  app.get("/readyz", ready);
  app.get("/api/v1/health", getHealth);
  app.get("/api/v1/healthz", getHealth);
  app.get("/api/v1/readyz", ready);
  app.get("/", (_req, res) => res.json({ message: "EntregaProva API está ativa!" }));
  // JSON escaping can expand a 1 MiB XML string up to sixfold.
  app.use(express.json({ limit: 7 * 1024 * 1024 }));
  app.use("/api/v1", createRoutes(deps));
  app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    let status = 500;
    let message = "Erro interno";
    if (error instanceof HttpError) {
      status = error.status;
      message = error.message;
    } else if (error instanceof MulterError) {
      status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      message = "Upload inválido ou acima do limite permitido";
    } else if (error?.type === "entity.too.large") {
      status = 413;
      message = "Corpo da requisição acima do limite";
    } else if (error?.type === "entity.parse.failed") {
      status = 400;
      message = "JSON inválido";
    }
    if (status === 500) deps.logger.error({
      severity: "ERROR", event: "request_failed", status,
      requestId: res.locals.requestId, tenantId: _req.user?.tenantId ?? null,
      route: routeTemplate(_req),
    });
    res.status(status).json({ error: message });
  };
  app.use(handleError);
  return app;
}
