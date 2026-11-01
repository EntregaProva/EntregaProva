import { Request, Response, NextFunction } from "express";
import { AppDependencies } from "../dependencies.js";

export type Role = "admin" | "operator" | "driver";
export interface AuthenticatedUser { uid: string; tenantId: string; role: Role }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthenticatedUser }
  }
}

export const authenticateToken = (auth: AppDependencies["auth"]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
    if (!match) return res.status(401).json({ error: "Token ausente ou inválido" });
    try {
      const { tenantId, role, uid } = await auth.verifyIdToken(match[1]);
      if (typeof tenantId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId) ||
          typeof role !== "string" || !["admin", "operator", "driver"].includes(role)) {
        return res.status(403).json({ error: "Claims de tenant ou papel inválidas" });
      }
      req.user = { uid, tenantId, role: role as Role };
      return next();
    } catch {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
  };

export const requireRole = (roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permissão insuficiente" });
    }
    return next();
  };
