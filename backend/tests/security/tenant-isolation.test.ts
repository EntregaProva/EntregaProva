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
