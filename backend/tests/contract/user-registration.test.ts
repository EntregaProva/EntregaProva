import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { fixture } from "../helpers.js";

const input = { email: "motorista@example.test", role: "driver" };

function setup() {
  const f = fixture();
  const account = { uid: "convidado", email: input.email, emailVerified: true, disabled: false };
  const auth = {
    ...f.deps.auth,
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === "convidado") return { uid: account.uid, email: account.email, email_verified: account.emailVerified };
      return f.deps.auth.verifyIdToken(token);
    }),
    getUser: vi.fn().mockResolvedValue(account),
    getUserByEmail: vi.fn().mockRejectedValue(Object.assign(new Error("Conta ausente"), { code: "auth/user-not-found" })),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn(),
  };
  const app = createApp({ ...f.deps, auth });
  const post = () => request(app).post("/api/v1/usuarios");
  const invite = () => post().auth("admin", { type: "bearer" }).send(input);
  const accept = (codigo: string) => request(app).post("/api/v1/convites/aceitar")
    .auth("convidado", { type: "bearer" }).send({ codigo, tenantId: "tenant-b", role: "admin" });
  return { auth, account, post, invite, accept, documents: f.documents };
}

describe("Convites de membros da empresa", () => {
  it("exige papel de administrador para gerar convite", async () => {
    const { auth, post } = setup();
    expect((await post().send(input)).status).toBe(401);
    for (const role of ["operator", "driver"]) {
      expect((await post().auth(role, { type: "bearer" }).send(input)).status).toBe(403);
    }
    expect(auth.getUserByEmail).not.toHaveBeenCalled();
  });

  it.each([{ ...input, role: "admin" }, { ...input, tenantId: "tenant-b" }, { ...input, email: "inválido" }])(
    "recusa dados que não respeitam o contrato",
    async body => {
      const { auth, post } = setup();
      expect((await post().auth("admin", { type: "bearer" }).send(body)).status).toBe(400);
      expect(auth.getUserByEmail).not.toHaveBeenCalled();
    },
  );

  it("não reserva o e-mail nem altera permissões antes do aceite pela conta verificada", async () => {
    const { auth, invite, accept } = setup();
    const result = await invite();
    expect(result.status).toBe(201);
    expect(result.body.uid).toBeUndefined();
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect((await accept(result.body.codigo)).status).toBe(204);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("convidado", { role: "driver", tenantId: "tenant-a" });
  });

  it("recusa e-mail não verificado, diferente ou convite vencido", async () => {
    const { auth, account, invite, accept, documents } = setup();
    const { body } = await invite();
    account.emailVerified = false;
    expect((await accept(body.codigo)).status).toBe(422);
    account.emailVerified = true;
    account.email = "outra-pessoa@example.test";
    expect((await accept(body.codigo)).status).toBe(404);
    account.email = input.email;
    for (const doc of documents.values()) doc.expiraEm = 0;
    expect((await accept(body.codigo)).status).toBe(404);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("preserva a empresa de um usuário já vinculado", async () => {
    const { auth, account, invite, accept } = setup();
    auth.getUser.mockResolvedValue({ ...account, customClaims: { tenantId: "tenant-b", role: "operator" } });
    const { body } = await invite();
    expect((await accept(body.codigo)).status).toBe(409);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("permite retentar o mesmo aceite após falha do Firebase", async () => {
    const { auth, invite, accept } = setup();
    const { body } = await invite();
    auth.setCustomUserClaims.mockRejectedValueOnce(new Error("Falha simulada"));
    expect((await accept(body.codigo)).status).toBe(500);
    expect((await accept(body.codigo)).status).toBe(204);
    expect(auth.setCustomUserClaims.mock.calls[1]).toEqual(auth.setCustomUserClaims.mock.calls[0]);
  });
});
