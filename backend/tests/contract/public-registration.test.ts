import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { fixture } from "../helpers.js";

const cpf = { tipo: "cpf", documento: "529.982.247-25", papel: "driver" };
const cnpj = { tipo: "cnpj", documento: "12.345.678/0001-95", papel: "admin" };

function setup(emailVerified = true, customClaims = {}) {
  const f = fixture();
  const auth = {
    ...f.deps.auth,
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "conta-teste", email_verified: emailVerified }),
    getUser: vi.fn().mockResolvedValue({ emailVerified, customClaims }),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({ ...f.deps, auth });
  const post = () => request(app).post("/api/v1/cadastros");
  const register = (body: object) => post().auth("token-teste", { type: "bearer" }).send(body);
  return { ...f, auth, post, register };
}

describe("Cadastro público no login", () => {
  it("exige autenticação e confirmação do e-mail antes de atribuir acesso", async () => {
    const { post, register, auth } = setup(false);
    expect((await post().send(cpf)).status).toBe(401);
    expect((await register(cpf)).status).toBe(422);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it.each([cpf, cnpj, { ...cnpj, papel: "operator" }])("cria um espaço isolado com o papel permitido", async (input) => {
    const { register, auth, documents } = setup();
    expect((await register(input)).status).toBe(204);
    const [uid, claims] = auth.setCustomUserClaims.mock.calls[0];
    expect(uid).toBe("conta-teste");
    expect(claims).toEqual({ role: input.papel, tenantId: expect.stringMatching(/^cadastro-[a-f0-9]{64}$/) });
    expect(documents.get(`cadastrosPublicos/${claims.tenantId}`)).toMatchObject({ tipo: input.tipo, papel: input.papel });
  });

  it.each([{ ...cnpj, papel: "driver" }, { ...cpf, documento: "111.111.111-11" }, { ...cpf, tenantId: "tenant-a" }])(
    "rejeita papel, documento ou vínculo inválido",
    async (input) => {
      const { register, auth } = setup();
      expect((await register(input)).status).toBe(400);
      expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    },
  );

  it("preserva a vinculação de uma conta já cadastrada por outro fluxo", async () => {
    const { register, auth } = setup(true, { tenantId: "tenant-a", role: "operator" });
    expect((await register(cpf)).status).toBe(409);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("recupera a atribuição de permissões após uma falha sem mudar o papel reservado", async () => {
    const { register, auth, documents } = setup();
    auth.setCustomUserClaims.mockRejectedValueOnce(new Error("Falha simulada"));
    expect((await register(cnpj)).status).toBe(500);
    expect((await register({ ...cnpj, papel: "operator" })).status).toBe(204);
    expect(auth.setCustomUserClaims.mock.calls[1]).toEqual(auth.setCustomUserClaims.mock.calls[0]);
    expect(documents.size).toBe(1);
  });
});
