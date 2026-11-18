import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import type { AppDependencies } from "../dependencies.js";
import type { Role } from "../middlewares/auth.middleware.js";
import { HttpError } from "../utils/httpError.js";

function validarDocumento(tipo: "cpf" | "cnpj", valor: unknown): string {
  const documento = typeof valor === "string" && valor.length <= 24
    ? valor.trim().replace(/[./-]/g, "").toUpperCase()
    : "";
  const formato = tipo === "cpf" ? /^\d{11}$/ : /^[A-Z0-9]{12}\d{2}$/;
  if (!formato.test(documento) || /^(.)\1+$/.test(documento)) {
    throw new HttpError(400, `Informe um ${tipo.toUpperCase()} válido.`);
  }
  const base = documento.slice(0, -2);
  const digito = (parte: string) => {
    const soma = [...parte].reduce((total, caractere, indice) => {
      const distancia = parte.length - 1 - indice;
      const peso = 2 + (tipo === "cpf" ? distancia : distancia % 8);
      return total + (caractere.charCodeAt(0) - 48) * peso;
    }, 0);
    const resto = soma % 11;
    return resto < 2 ? "0" : String(11 - resto);
  };
  const primeiro = digito(base);
  if (documento !== base + primeiro + digito(base + primeiro)) {
    throw new HttpError(400, `Informe um ${tipo.toUpperCase()} válido.`);
  }
  return documento;
}

export function createRegistrationController({ auth, db }: AppDependencies): RequestHandler {
  return async (req, res, next) => {
    const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
    if (!bearer) return next(new HttpError(401, "Entre para concluir o cadastro."));
    const token = await auth.verifyIdToken(bearer[1]).catch(() => null);
    if (!token) return next(new HttpError(401, "Token inválido ou expirado."));
    if (!token.email_verified) return next(new HttpError(422, "Confirme seu e-mail para concluir o cadastro."));

    try {
      const conta = await auth.getUser(token.uid);
      if (!conta.emailVerified || conta.disabled) throw new HttpError(422, "Confirme seu e-mail para concluir o cadastro.");

      // O documento informado nunca concede acesso a uma empresa existente.
      const tenantId = "cadastro-" + createHash("sha256").update(token.uid).digest("hex");
      const claims = conta.customClaims ?? {};
      if (claims.tenantId === tenantId && claims.role) {
        res.sendStatus(204);
        return;
      }
      if (claims.role !== undefined || claims.tenantId !== undefined) {
        throw new HttpError(409, "Esta conta já pertence a um espaço de trabalho.");
      }

      const { tipo, documento, papel } = req.body ?? {};
      if (tipo !== "cpf" && tipo !== "cnpj") throw new HttpError(400, "Escolha CPF ou CNPJ.");
      if (papel !== "admin" && papel !== "operator" && !(tipo === "cpf" && papel === "driver")) {
        throw new HttpError(400, "Escolha um papel válido para esse tipo de cadastro.");
      }
      if (Object.hasOwn(req.body, "tenantId")) throw new HttpError(400, "O espaço de trabalho é definido pelo servidor.");
      const documentoValidado = validarDocumento(tipo, documento);
      const perfil = db.doc(`cadastrosPublicos/${tenantId}`);
      const papelSalvo = await db.runTransaction(async (tx) => {
        const existente = await tx.get(perfil);
        if (existente.exists) return existente.data()?.papel as Role;
        tx.create(perfil, { uid: token.uid, tipo, documento: documentoValidado, papel, criadoEm: new Date() });
        return papel as Role;
      });
      await auth.setCustomUserClaims(token.uid, { ...claims, tenantId, role: papelSalvo });
      res.sendStatus(204);
    } catch (erro) {
      next(erro);
    }
  };
}
