import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { fixture, key, path } from "../helpers.js";

describe("Isolamento nas rotas reais", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => { f = fixture(); f.seed(); f.seed("tenant-b", "driver-b"); });

  it("exige token válido", async () => {
    for (const token of ["", "invalid"]) {
      const req = request(f.app).get(`/api/v1/entregas/${key}`);
      if (token) req.auth(token, { type: "bearer" });
      expect((await req).status).toBe(401);
    }
  });
  it.each([
    ["operator", 200], ["driver", 200], ["otherDriver", 403],
  ])("leitura: %s => %i", async (token, status) => {
    expect((await request(f.app).get(`/api/v1/entregas/${key}`).auth(token, { type: "bearer" })).status).toBe(status);
  });
  it("não lê o mesmo ID de outro tenant e ignora header", async () => {
    f.documents.delete(path("tenant-b"));
    const res = await request(f.app).get(`/api/v1/entregas/${key}`)
      .auth("otherTenant", { type: "bearer" }).set("x-tenant-id", "tenant-a");
    expect(res.status).toBe(404);
  });
  it.each([
    { uid: "u", role: "driver" },
    { uid: "u", tenantId: "tenant-a" },
    { uid: "u", tenantId: "tenant-a", role: "owner" },
    { uid: "u", tenantId: "../tenant-a", role: "admin" },
  ])("recusa claims ausentes ou inválidas: %j", async claims => {
    f.users.bad = claims;
    const res = await request(f.app).get(`/api/v1/entregas/${key}`)
      .auth("bad", { type: "bearer" }).set("x-tenant-id", "tenant-a");
    expect(res.status).toBe(403);
  });
  it("bloqueia comprovante de outro motorista antes do upload", async () => {
    const res = await request(f.app).post(`/api/v1/entregas/${key}/comprovantes`)
      .auth("otherDriver", { type: "bearer" });
    expect(res.status).toBe(403);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.documents.get(path())?.status).toBe("PENDENTE");
  });
  it("bloqueia comprovante de outro tenant com 404", async () => {
    f.documents.delete(path("tenant-b"));
    const res = await request(f.app).post(`/api/v1/entregas/${key}/comprovantes`)
      .auth("otherTenant", { type: "bearer" });
    expect(res.status).toBe(404);
    expect(f.documents.get(path())?.status).toBe("PENDENTE");
  });
  it("motorista não pode conferir", async () => {
    const res = await request(f.app).post(`/api/v1/entregas/${key}/conferencia`)
      .auth("driver", { type: "bearer" }).send({ decisao: "APROVAR" });
    expect(res.status).toBe(403);
  });
  it("operador de outro tenant não pode conferir", async () => {
    f.users.operatorB = { uid: "ob", tenantId: "tenant-b", role: "operator" };
    f.documents.delete(path("tenant-b"));
    const res = await request(f.app).post(`/api/v1/entregas/${key}/conferencia`)
      .auth("operatorB", { type: "bearer" }).send({ decisao: "APROVAR" });
    expect(res.status).toBe(404);
    expect(f.documents.get(path())?.status).toBe("PENDENTE");
  });
});

    operadorA = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "operator" });
operadorB = await createAuthenticatedUser(app, { tenantId: "tenant-b", role: "operator" });
motorista1A = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "driver" });
motorista2A = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "driver" });

    entregaDoMotorista1 = await app.testing.createDelivery({
tenantId: "tenant-a",
driverId: motorista1A.uid,
nfeKey: "11111111111111111111111111111111111111111111",
status: "PENDENTE",
});
entregaB = await app.testing.createDelivery({
tenantId: "tenant-b",
nfeKey: "12345678901234567890123456789012345678901234",
status: "PENDENTE",
});
});

  describe("CT-20: sem token ou token vencido → 401", () => {
it("CT-20.1: GET /entregas/{id} sem token", async () => {
const res = await chamar("get", rotas.entrega(entregaDoMotorista1.id));
expect(res.status).toBe(401);
});

    it("CT-20.2: GET /entregas/{id} com token vencido", async () => {
const vencido = await createAuthenticatedUser(app, {
tenantId: "tenant-a",
role: "operator",
expired: true,
});
const res = await chamar("get", rotas.entrega(entregaDoMotorista1.id), vencido);
expect(res.status).toBe(401);
});

    it("CT-20.3: POST /comprovantes sem token", async () => {
const res = await chamar("post", rotas.comprovantes(entregaDoMotorista1.id));
expect(res.status).toBe(401);
});

    it("CT-20.4: POST /conferencia sem token", async () => {
const res = await chamar("post", rotas.conferencia(entregaDoMotorista1.id));
expect(res.status).toBe(401);
});
});

  describe("CT-21: papel ou dono errado → 403, sem alterar a entrega", () => {
it("CT-21.1: motorista não lê entrega de outro motorista", async () => {
const res = await chamar("get", rotas.entrega(entregaDoMotorista1.id), motorista2A);
expect(res.status).toBe(403);
});

    it("CT-21.2: motorista não envia comprovante em entrega de outro motorista", async () => {
const res = await chamar("post", rotas.comprovantes(entregaDoMotorista1.id), motorista2A);
expect(res.status).toBe(403);
expect(await statusDaEntrega(entregaDoMotorista1.id, operadorA)).toBe("PENDENTE");
});

    it("CT-21.3: motorista não confere entrega de outro motorista", async () => {
const res = await chamar("post", rotas.conferencia(entregaDoMotorista1.id), motorista2A);
expect(res.status).toBe(403);
expect(await statusDaEntrega(entregaDoMotorista1.id, operadorA)).toBe("PENDENTE");
});

    it("CT-21.4: motorista não confere nem a própria entrega", async () => {
const res = await chamar("post", rotas.conferencia(entregaDoMotorista1.id), motorista1A);
expect(res.status).toBe(403);
expect(await statusDaEntrega(entregaDoMotorista1.id, operadorA)).toBe("PENDENTE");
});
});

  describe("CT-22: outro tenant → 404 (nem revela que a entrega existe)", () => {
it("CT-22.1: operador não lê entrega de outro tenant", async () => {
const res = await chamar("get", rotas.entrega(entregaB.id), operadorA);
expect(res.status).toBe(404);
});

    it("CT-22.2: operador não envia comprovante em outro tenant e o estado não muda", async () => {
const res = await chamar("post", rotas.comprovantes(entregaB.id), operadorA);
expect(res.status).toBe(404);
expect(await statusDaEntrega(entregaB.id, operadorB)).toBe("PENDENTE");
});

    it("CT-22.3: operador não confere entrega de outro tenant e o estado não muda", async () => {
const res = await chamar("post", rotas.conferencia(entregaB.id), operadorA);
expect(res.status).toBe(404);
expect(await statusDaEntrega(entregaB.id, operadorB)).toBe("PENDENTE");
});

    it("CT-22.4: operador lê entrega do próprio tenant (controle positivo)", async () => {
const res = await chamar("get", rotas.entrega(entregaDoMotorista1.id), operadorA);
expect(res.status).toBe(200);
});

    it("CT-22.5: motorista lê a própria entrega (controle positivo)", async () => {
const res = await chamar("get", rotas.entrega(entregaDoMotorista1.id), motorista1A);
expect(res.status).toBe(200);
});
});
});