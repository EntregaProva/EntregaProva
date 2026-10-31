import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
createTestApp,
createTenantFixture,
createAuthenticatedUser,
} from "../../src/app.js";
type User = Awaited<ReturnType<typeof createAuthenticatedUser>>;

type App = Awaited<ReturnType<typeof createTestApp>>;
type Metodo = "get" | "post";

const BASE = "/api/v1";

const rotas = {
  entrega: (id: string) => `/entregas/${id}`,
  comprovantes: (id: string) => `/entregas/${id}/comprovantes`,
  conferencia: (id: string) => `/entregas/${id}/conferencia`,
};

describe("Autorização e isolamento - entregas", () => {
let app: App;
let operadorA: User;
let operadorB: User;
let motorista1A: User;
let motorista2A: User;
let entregaDoMotorista1: { id: string };
let entregaB: { id: string };

  const chamar = (metodo: Metodo, caminho: string, usuario?: User) => {
  const req = request(app)[metodo](`${BASE}${caminho}`);
  if (usuario) req.set("Authorization", `Bearer ${usuario.idToken}`);
  return metodo === "post" ? req.send({}) : req;
};

  const statusDaEntrega = async (id: string, leitor: User) => {
const res = await chamar("get", rotas.entrega(id), leitor);
expect(res.status).toBe(200);
return res.body.status;
};

  beforeEach(async () => {
app = await createTestApp({ environment: "test" });
await createTenantFixture(app, {
tenantA: { id: "tenant-a", name: "Transportadora A" },
tenantB: { id: "tenant-b", name: "Transportadora B" },
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