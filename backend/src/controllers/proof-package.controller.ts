import type { RequestHandler } from "express";
import type { AppDependencies } from "../dependencies.js";
import { createProofPackageService } from "../services/proof-package.service.js";

export function createProofPackageControllers(deps: AppDependencies) {
  const service = createProofPackageService(deps);
  const wrap = (handler: RequestHandler): RequestHandler =>
    (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
  return {
    create: wrap(async (req, res) => {
      const job = await service.create(req.user!.tenantId, req.user!.uid, req.body);
      res.status(202).location(`/api/v1/pacotes-comprovacao/${job.id}`).json(job);
    }),
    get: wrap(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.get(req.user!.tenantId, req.params.id));
    }),
    download: wrap(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      const bytes = await service.download(req.params.id, req.query);
      res.type("application/zip").attachment(`comprovacao-${req.params.id}.zip`).send(bytes);
    }),
  };
}
