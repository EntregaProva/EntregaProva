import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { fixture, key, path } from "../helpers.js";

const entrega = `/api/v1/entregas/${key}`;

describe("Autorização e isolamento - entregas", () => {
  let f: ReturnType<typeof fixture>;

  const comToken = (req: request.Test, token?: string) =>
    token ? req.auth(token, { type: "bearer" }) : req;

  const get = (url: string, token?: string) =>
    comToken(request(f.app).get(url), token);

  const post = (url: string, token?: string, body: object = {}) =>
    comToken(request(f.app).post(url), token).send(body);

  const statusDaEntrega = () => f.documents.get(path())?.status;

  beforeEach(() => {
    f = fixture();
    f.seed();
    f.users.operatorB = { uid: "operator-b", tenantId: "tenant-b", role: "operator" };
  });

  describe("CT-20: sem token, token inválido ou vencido retorna 401", () => {
    it.each([
      ["get", "/api/v1/entregas"],
      ["get", "/api/v1/deliveries"],
      ["get", entrega],
      ["get", `/api/v1/deliveries/${key}`],
      ["post", "/api/v1/entregas/xml"],
      ["post", "/api/v1/deliveries/xml"],
      ["post", `${entrega}/comprovantes`],
      ["post", `/api/v1/deliveries/${key}/proof`],
      ["post", `${entrega}/conferencia`],
      ["patch", `/api/v1/deliveries/${key}/check`],
    ] as const)("recusa %s %s sem token antes de acessar os dados", async (method, url) => {
      const res = await request(f.app)[method](url);
      expect(res.status).toBe(401);
      expect(f.read).not.toHaveBeenCalled();
      expect(f.runTransaction).not.toHaveBeenCalled();
      expect(f.save).not.toHaveBeenCalled();
    });

    it("CT-20.2: GET /entregas/{id} com token vencido", async () => {
      vi.mocked(f.deps.auth.verifyIdToken).mockRejectedValueOnce(
        Object.assign(new Error("Firebase ID token has expired"), { code: "auth/id-token-expired" }),
      );

      expect((await get(entrega, "token-vencido")).status).toBe(401);
    });

    it("CT-20.5: GET /entregas/{id} com token não reconhecido", async () => {
      expect((await get(entrega, "invalid")).status).toBe(401);
    });
  });

  describe("CT-21: papel ou dono errado retorna 403 e não altera a entrega", () => {
    it("CT-21.1: motorista não lê entrega de outro motorista", async () => {
      expect((await get(entrega, "otherDriver")).status).toBe(403);
    });

    it("CT-21.2: motorista não envia comprovante de outro motorista", async () => {
      expect((await post(`${entrega}/comprovantes`, "otherDriver")).status).toBe(403);
      expect(f.save).not.toHaveBeenCalled();
      expect(statusDaEntrega()).toBe("PENDENTE");
    });

    it("CT-21.3: motorista não confere entrega de outro motorista", async () => {
      expect((await post(`${entrega}/conferencia`, "otherDriver", { decisao: "APROVAR" })).status).toBe(403);
      expect(statusDaEntrega()).toBe("PENDENTE");
    });

    it("CT-21.4: motorista não confere nem a própria entrega", async () => {
      expect((await post(`${entrega}/conferencia`, "driver", { decisao: "APROVAR" })).status).toBe(403);
      expect(statusDaEntrega()).toBe("PENDENTE");
    });

    it("CT-21.5: operador não envia comprovante", async () => {
      expect((await post(`${entrega}/comprovantes`, "operator")).status).toBe(403);
      expect(f.save).not.toHaveBeenCalled();
    });

    it("CT-21.6: motorista não importa XML", async () => {
      const res = await post("/api/v1/entregas/xml", "driver", { xmlContent: "<NFe/>" });

      expect(res.status).toBe(403);
      expect(f.documents.size).toBe(1);
    });
  });

  describe("CT-22: outro tenant retorna 404", () => {
    it("CT-22.1: motorista de outro tenant não lê a entrega", async () => {
      expect((await get(entrega, "otherTenant")).status).toBe(404);
    });

    it("CT-22.2: motorista de outro tenant não envia comprovante", async () => {
      expect((await post(`${entrega}/comprovantes`, "otherTenant")).status).toBe(404);
      expect(f.save).not.toHaveBeenCalled();
      expect(statusDaEntrega()).toBe("PENDENTE");
    });

    it("CT-22.3: operador de outro tenant não confere a entrega", async () => {
      expect((await post(`${entrega}/conferencia`, "operatorB", { decisao: "APROVAR" })).status).toBe(404);
      expect(statusDaEntrega()).toBe("PENDENTE");
    });

    it("CT-22.4: operador lê entrega do próprio tenant", async () => {
      expect((await get(entrega, "operator")).status).toBe(200);
    });

    it("CT-22.5: motorista lê a própria entrega", async () => {
      expect((await get(entrega, "driver")).status).toBe(200);
    });
  });

  describe("US-06 - tenant e claims vêm só do token", () => {
    it("CT-47: ignora o header x-tenant-id e consulta apenas o tenant do token (404)", async () => {
      const res = await get(entrega, "otherTenant").set("x-tenant-id", "tenant-a");

      expect(res.status).toBe(404);
      expect(f.read).toHaveBeenCalledWith({ path: path("tenant-b") });
      expect(f.read).not.toHaveBeenCalledWith({ path: path("tenant-a") });
    });

    it.each([
      { id: "CT-48.1", caso: "sem tenantId", claims: { uid: "u", role: "driver" } },
      { id: "CT-48.2", caso: "sem role", claims: { uid: "u", tenantId: "tenant-a" } },
      { id: "CT-48.3", caso: "role fora da lista", claims: { uid: "u", tenantId: "tenant-a", role: "owner" } },
      { id: "CT-48.4", caso: "tenantId com path traversal", claims: { uid: "u", tenantId: "../tenant-a", role: "admin" } },
    ])("$id: recusa claims inválidas ($caso) com 403, sem consultar o banco", async ({ claims }) => {
      f.users.bad = claims;

      const res = await get(entrega, "bad").set("x-tenant-id", "tenant-a");

      expect(res.status).toBe(403);
      expect(f.read).not.toHaveBeenCalled();
    });
  });
});
