import request from "supertest";
import { expect, it } from "vitest";
import { fixture } from "../helpers.js";

it("mantém o formato da listagem mesmo sem entregas", async () => {
    const f = fixture();
    Object.assign(f.deps.db, {
        collection: () => ({
            orderBy: () => ({
                limit: () => ({ get: async () => ({ docs: [] }) }),
            }),
        }),
    });

    const res = await request(f.app)
        .get("/api/v1/entregas")
        .auth("operator", { type: "bearer" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
        itens: [],
        proximoCursor: null,
    });
});
