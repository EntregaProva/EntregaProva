import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestApp,
  createTenantFixture,
  createAuthenticatedUser,
} from "../../src/app.js";

type App = Awaited<ReturnType<typeof createTestApp>>;
type User = Awaited<ReturnType<typeof createAuthenticatedUser>>;

// OBS: depende de createTestApp e das rotas /deliveries no backend.
describe("Isolamento de tenant - entregas", () => {
  let app: App;
  let userA: User;
  let userB: User;
  let deliveryA: { id: string };
  let deliveryB: { id: string };

  beforeEach(async () => {
    app = await createTestApp({ environment: "test" });

    await createTenantFixture(app, {
      tenantA: { id: "tenant-a", name: "Transportadora A" },
      tenantB: { id: "tenant-b", name: "Transportadora B" },
    });

    userA = await createAuthenticatedUser(app, {
      tenantId: "tenant-a",
      role: "operator",
    });

    userB = await createAuthenticatedUser(app, {
      tenantId: "tenant-b",
      role: "operator",
    });

    deliveryA = await app.testing.createDelivery({
      tenantId: "tenant-a",
      nfeKey: "11111111111111111111111111111111111111111111",
      status: "pendente",
    });

    deliveryB = await app.testing.createDelivery({
      tenantId: "tenant-b",
      nfeKey: "12345678901234567890123456789012345678901234",
      status: "pendente",
    });
  });

  const request = (
    method: string,
    path: string,
    user?: User,
    body?: object,
  ) =>
    app.request(path, {
      method,
      headers: {
        ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  it("impede leitura de entrega de outro tenant", async () => {
    const response = await request("GET", `/deliveries/${deliveryB.id}`, userA);
    expect([403, 404]).toContain(response.status);
  });

  it("impede alteração de entrega de outro tenant", async () => {
    const response = await request("PATCH", `/deliveries/${deliveryB.id}`, userA, {
      status: "entregue",
    });
    expect([403, 404]).toContain(response.status);

    const check = await request("GET", `/deliveries/${deliveryB.id}`, userB);
    const delivery = await check.json();
    expect(check.status).toBe(200);
    expect(delivery.status).toBe("pendente");
  });

  it("impede exclusão de entrega de outro tenant", async () => {
    const response = await request("DELETE", `/deliveries/${deliveryB.id}`, userA);
    expect([403, 404]).toContain(response.status);

    const check = await request("GET", `/deliveries/${deliveryB.id}`, userB);
    expect(check.status).toBe(200);
  });

  it("não lista entregas de outro tenant", async () => {
    const response = await request("GET", "/deliveries", userA);
    const deliveries = await response.json();
    const ids = deliveries.map((d: { id: string }) => d.id);

    expect(response.status).toBe(200);
    expect(ids).toContain(deliveryA.id);
    expect(ids).not.toContain(deliveryB.id);
  });

  it("rejeita requisição sem token", async () => {
    const response = await request("GET", `/deliveries/${deliveryB.id}`);
    expect(response.status).toBe(401);
  });

  it("permite leitura de entrega do próprio tenant", async () => {
    const response = await request("GET", `/deliveries/${deliveryA.id}`, userA);
    expect(response.status).toBe(200);
  });
});
