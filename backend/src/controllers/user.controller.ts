import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { AppDependencies } from "../dependencies.js";
import { HttpError } from "../utils/httpError.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const validadeMs = 7 * 24 * 60 * 60 * 1000;

export function createUserController({ auth, db }: AppDependencies): RequestHandler {
  return async (req, res, next) => {
    try {
      const { email, role } = req.body ?? {};
      const address = typeof email === "string" ? email.trim().toLowerCase() : "";
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
      const membro = await auth.getUserByEmail(address).catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "auth/user-not-found") return null;
        throw error;
      });
      res.set("Cache-Control", "no-store");
      if (membro?.customClaims?.tenantId === tenantId) {
        if (membro.customClaims.role !== role) throw new HttpError(409, "Já existe um membro com outro papel nesta empresa.");
        res.json({ uid: membro.uid, role });
        return;
      }
      const codigo = randomBytes(24).toString("base64url");
      const expiraEm = Date.now() + validadeMs;
      await db.doc(`convitesUsuarios/${hash(codigo)}`).create({
        email: address, papel: role, tenantId, expiraEm,
      });
      res.status(201).json({ codigo, expiraEm: new Date(expiraEm).toISOString() });
    } catch (error) {
      next(error);
    }
  };
}

export function acceptUserInvitation({ auth, db }: AppDependencies): RequestHandler {
  return async (req, res, next) => {
    try {
      const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
      if (!bearer) throw new HttpError(401, "Entre para aceitar o convite.");
      const token = await auth.verifyIdToken(bearer[1], true).catch(() => null);
      if (!token) throw new HttpError(401, "Token inválido ou expirado.");
      const conta = await auth.getUser(token.uid);
      if (!token.email_verified || !conta.emailVerified || conta.disabled || !conta.email ||
        token.email?.toLowerCase() !== conta.email.toLowerCase()) {
        throw new HttpError(422, "Confirme seu e-mail para aceitar o convite.");
      }
      const codigo = typeof req.body?.codigo === "string" ? req.body.codigo.trim() : "";
      if (!/^[A-Za-z0-9_-]{32}$/.test(codigo)) throw new HttpError(400, "Informe um código de convite válido.");

      const conviteId = hash(codigo);
      const convite = db.doc(`convitesUsuarios/${conviteId}`);
      const perfil = db.doc(`cadastrosPublicos/cadastro-${hash(token.uid)}`);
      const claims = conta.customClaims ?? {};
      const email = conta.email.toLowerCase();
      const acesso = await db.runTransaction(async (tx) => {
        const dados = (await tx.get(convite)).data();
        if (!dados || dados.email !== email ||
          (dados.aceitoPor ? dados.aceitoPor !== token.uid : dados.expiraEm <= Date.now())) {
          throw new HttpError(404, "Convite indisponível para esta conta.");
        }
        const { tenantId, papel: role } = dados;
        // O cadastro público usa o mesmo documento para reservar a vinculação desta conta.
        const reservado = (await tx.get(perfil)).data();
        if (reservado?.conviteId === conviteId && dados.aceitoPor === token.uid) {
          if (claims.tenantId === tenantId && claims.role === role) return null;
        } else if (reservado || dados.aceitoPor) {
          throw new HttpError(409, "Esta conta já pertence a um espaço de trabalho.");
        }
        if (claims.tenantId !== undefined || claims.role !== undefined) {
          throw new HttpError(409, "Esta conta já pertence a um espaço de trabalho.");
        }
        if (!reservado) {
          tx.create(perfil, { uid: token.uid, conviteId, tenantId, papel: role, criadoEm: new Date() });
          tx.update(convite, { aceitoPor: token.uid });
        }
        return { tenantId, role };
      });
      if (acesso) await auth.setCustomUserClaims(token.uid, { ...claims, ...acesso });
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };
}
