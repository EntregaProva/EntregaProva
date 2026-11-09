import { Request, Response } from "express";

export const getHealth = (_req: Request, res: Response) => {
  return res.status(200).json({
    status: "ok",
    service: "entregaprova-api",
    revision: process.env.RENDER_GIT_COMMIT || process.env.APP_REVISION || "local",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
};
