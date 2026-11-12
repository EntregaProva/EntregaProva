import type { UserRecord } from "firebase-admin/auth";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { fixture } from "../helpers.js";

const input = { email: "motorista@example.test", role: "driver" };

function setup() {
  const f = fixture();
  const auth = {
    ...f.deps.auth,
    createUser: vi.fn().mockResolvedValue({ uid: "novo-uid" } as UserRecord),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({ ...f.deps, auth });
  return { auth, post: () => request(app).post("/api/v1/usuarios") };
}

describe("Cadastro de usuários da empresa", () => {
  it("exige token e papel de administrador", async () => {
    const { auth, post } = setup();
    expect((await post().send(input)).status).toBe(401);
    for (const role of ["operator", "driver"]) {
      expect((await post().auth(role, { type: "bearer" }).send(input)).status).toBe(403);
    }
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it.each([{ ...input, role: "admin" }, { ...input, tenantId: "tenant-b" }, { ...input, email: "inválido" }])(
    "recusa dados que não respeitam o contrato",
    async body => {
      const { auth, post } = setup();
      expect((await post().auth("admin", { type: "bearer" }).send(body)).status).toBe(400);
      expect(auth.createUser).not.toHaveBeenCalled();
    },
  );

  it("remove somente a conta recém-criada se a definição das permissões falhar", async () => {
    const { auth, post } = setup();
    auth.setCustomUserClaims.mockRejectedValueOnce(new Error("Falha simulada"));
    const result = await post().auth("admin", { type: "bearer" }).send(input);
    expect(result.status).toBe(500);
    expect(auth.createUser).toHaveBeenCalledWith({ email: input.email });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("novo-uid", { role: "driver", tenantId: "tenant-a" });
    expect(auth.deleteUser).toHaveBeenCalledWith("novo-uid");
  });
});
