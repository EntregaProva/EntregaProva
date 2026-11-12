import type { RequestHandler } from "express";
import type { AppDependencies } from "../dependencies.js";
import { HttpError } from "../utils/httpError.js";

export function createUserController({ auth, logger }: AppDependencies): RequestHandler {
  return async (req, res, next) => {
    try {
      const { email, role } = req.body ?? {};
      const address = typeof email === "string" ? email.trim() : "";
      if (!address || address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        throw new HttpError(400, "Informe um e-mail válido.");
      }
      if (role !== "operator" && role !== "driver") {
        throw new HttpError(400, "Escolha Operador ou Motorista.");
      }
      if (!req.user) throw new HttpError(401, "Autenticação obrigatória");
      if (Object.hasOwn(req.body, "tenantId")) {
        throw new HttpError(400, "A empresa é definida pela sessão do administrador.");
      }
      const tenantId = req.user.tenantId;
      // A pessoa define a senha pelo e-mail do Firebase.
      const user = await auth.createUser({ email: address });
      try {
        await auth.setCustomUserClaims(user.uid, { role, tenantId });
      } catch (error) {
        try {
          await auth.deleteUser(user.uid);
        } catch {
          logger.error({ severity: "ERROR", event: "user_registration_cleanup_failed", tenantId,
            requestId: res.locals.requestId });
        }
        throw error;
      }
      res.status(201).json({ uid: user.uid, role });
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        if (error.code === "auth/email-already-exists") {
          return next(new HttpError(409, "Não foi possível cadastrar este e-mail. Confira se já existe uma conta."));
        }
        if (error.code === "auth/invalid-email") {
          return next(new HttpError(400, "Informe um e-mail válido."));
        }
      }
      next(error);
    }
  };
}
