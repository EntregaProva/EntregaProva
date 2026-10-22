import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  createTenantFixture,
  createAuthenticatedUser,
} from "../../src/app.js";

type App = Awaited<ReturnType<typeof createTestApp>>;
type User = Awaited<ReturnType<typeof createAuthenticatedUser>>;

const BASE = "/api/v1";

describe("Isolamento de tenant e de motorista - entregas", () => {
  let app: App;
  let operatorA: User;
  let operatorB: User;
  let driver1A: User; 
  let driver2A: User; 
  let deliveryB: { id: string };
  let deliveryOfDriver1: { id: string };

  const call = (
    method: "get" | "post",
    path: string,
    user?: User,
    body?: object,
  ) => {
    let req = request(app)[method](`${BASE}${path}`);
    if (user) req = req.set("Authorization", `Bearer ${user.idToken}`);
    return body ? req.send(body) : req;
  };

  beforeEach(async () => {
    app = await createTestApp({ environment: "test" });
    await createTenantFixture(app, {
      tenantA: { id: "tenant-a", name: "Transportadora A" },
      tenantB: { id: "tenant-b", name: "Transportadora B" },
    });

    operatorA = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "operator" });
    operatorB = await createAuthenticatedUser(app, { tenantId: "tenant-b", role: "operator" });
    driver1A = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "driver" });
    driver2A = await createAuthenticatedUser(app, { tenantId: "tenant-a", role: "driver" });

    deliveryOfDriver1 = await app.testing.createDelivery({
      tenantId: "tenant-a",
      driverId: driver1A.uid,
      nfeKey: "11111111111111111111111111111111111111111111",
      status: "pendente",
    });
    deliveryB = await app.testing.createDelivery({
      tenantId: "tenant-b",
      nfeKey: "12345678901234567890123456789012345678901234",
      status: "pendente",
    });
  });

  describe("GET /entregas/{id}", () => {
    it("401 sem token", async () => {
      const res = await call("get", `/entregas/${deliveryB.id}`);
      expect(res.status).toBe(401);
    });

    it("200 para entrega do próprio tenant", async () => {
      const res = await call("get", `/entregas/${deliveryOfDriver1.id}`, operatorA);
      expect(res.status).toBe(200);
    });

    it("bloqueia leitura de entrega de outro tenant", async () => {
      const res = await call("get", `/entregas/${deliveryB.id}`, operatorA);
      expect([403, 404]).toContain(res.status);
    });

    it("403 quando motorista acessa entrega de outro motorista (mesmo tenant)", async () => {
      const res = await call("get", `/entregas/${deliveryOfDriver1.id}`, driver2A);
      expect(res.status).toBe(403);
    });

    it("200 quando o motorista acessa a própria entrega", async () => {
      const res = await call("get", `/entregas/${deliveryOfDriver1.id}`, driver1A);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /entregas/{id}/comprovantes", () => {
    it("bloqueia envio em entrega de outro tenant e não altera o estado", async () => {
      const res = await call("post", `/entregas/${deliveryB.id}/comprovantes`, operatorA, {});
      expect([403, 404]).toContain(res.status);

      const check = await call("get", `/entregas/${deliveryB.id}`, operatorB);
      expect(check.status).toBe(200);
      expect(check.body.status).toBe("pendente");
    });

    it("403 para motorista em entrega de outro motorista", async () => {
      const res = await call("post", `/entregas/${deliveryOfDriver1.id}/comprovantes`, driver2A, {});
      expect(res.status).toBe(403);
    });
  });

  describe("POST /entregas/{id}/conferencia", () => {
    it("bloqueia conferência em entrega de outro tenant e não altera o estado", async () => {
      const res = await call("post", `/entregas/${deliveryB.id}/conferencia`, operatorA, {});
      expect([403, 404]).toContain(res.status);

      const check = await call("get", `/entregas/${deliveryB.id}`, operatorB);
      expect(check.body.status).toBe("pendente");
    });

    it("403 para motorista em entrega de outro motorista", async () => {
      const res = await call("post", `/entregas/${deliveryOfDriver1.id}/conferencia`, driver2A, {});
      expect(res.status).toBe(403);
    });
  });
});
