import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";

export interface AuthenticatedUser {
  uid: string;
  tenantId: string;
  role: "admin" | "operator" | "driver";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação ausente ou inválido" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    // O tenantId pode vir das custom claims do Firebase ou de header validado
    const tenantId = (decodedToken.tenantId as string) || (req.headers["x-tenant-id"] as string);
    const role = (decodedToken.role as "admin" | "operator" | "driver") || "driver";

    if (!tenantId) {
      return res.status(403).json({ error: "Usuário não vinculado a um tenant ativo" });
    }

    req.user = {
      uid: decodedToken.uid,
      tenantId,
      role
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Sessão expirada ou token inválido" });
  }
};

export const requireRole = (allowedRoles: Array<"admin" | "operator" | "driver">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permissão insuficiente para esta operação" });
    }
    return next();
  };
};