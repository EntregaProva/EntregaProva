import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { fixture, xml } from "../helpers.js";

const SAMPLE_DELIVERY_ID = "35231012345678000195550010000001011234567891";

const neverResolves = () => new Promise<never>(() => undefined);

// O Supertest só dispara a requisição HTTP quando .then() é invocado
const fire = <T>(req: PromiseLike<T>): Promise<T> => Promise.resolve(req);

const expectNoInternalLeak = (body: unknown, internalDetail: string) => {
  expect(JSON.stringify(body)).not.toContain(internalDetail);
};

describe("CT-RES: falhas e timeouts de dependências", () => {
  let ctx: ReturnType<typeof fixture>;

  const getReadyz = () => request(ctx.app).get("/readyz");

  const listDeliveries = () =>
    request(ctx.app).get("/api/v1/entregas").set("Authorization", "Bearer operator");

  const getDelivery = (id = SAMPLE_DELIVERY_ID) =>
    request(ctx.app).get(`/api/v1/entregas/${id}`).set("Authorization", "Bearer operator");

  const importXml = () =>
    request(ctx.app)
      .post("/api/v1/entregas/xml")
      .set("Authorization", "Bearer operator")
      .send({ xmlContent: xml() });

  beforeEach(() => {
    ctx = fixture();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CT-RES-01: /readyz devolve 503 quando o Firestore não responde em 2 s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    ctx.read.mockImplementation(neverResolves);

    const pending = fire(getReadyz());
    await vi.waitFor(() => expect(ctx.read).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(2000);

    const res = await pending;
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });

  it("CT-RES-02: /readyz devolve 503 sem vazar detalhes quando o Firestore falha", async () => {
    ctx.read.mockRejectedValue(new Error("UNAVAILABLE: connection refused 10.0.0.1"));

    const res = await getReadyz();

    expect(res.status).toBe(503);
    expectNoInternalLeak(res.body, "10.0.0.1");
  });

  it("CT-RES-03: /readyz volta a 200 assim que o Firestore se recupera", async () => {
    ctx.read.mockRejectedValueOnce(new Error("down"));

    expect((await getReadyz()).status).toBe(503);
    expect((await getReadyz()).status).toBe(200);
  });

  it("CT-RES-04: Firebase Auth indisponível devolve 401, não 500", async () => {
    vi.mocked(ctx.deps.auth.verifyIdToken).mockRejectedValue(new Error("ETIMEDOUT auth"));

    const res = await listDeliveries();

    expect(res.status).toBe(401);
    expectNoInternalLeak(res.body, "ETIMEDOUT");
  });

  it("CT-RES-05: falha do Firestore na importação devolve 500 genérico e não grava nada", async () => {
    ctx.runTransaction.mockRejectedValueOnce(new Error("DEADLINE_EXCEEDED projects/x/databases"));

    const res = await importXml();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno" });
    expect(ctx.documents.size).toBe(0);
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });

  it("CT-RES-06: falha do Firestore na leitura do detalhe devolve 500 genérico", async () => {
    ctx.seed();
    ctx.read.mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED quota"));

    const res = await getDelivery();

    expect(res.status).toBe(500);
    expectNoInternalLeak(res.body, "quota");
  });

  it("CT-RES-07: importação pode ser repetida após falha sem deixar estado parcial", async () => {
    ctx.runTransaction.mockRejectedValueOnce(new Error("aborted"));

    expect((await importXml()).status).toBe(500);
    expect((await importXml()).status).toBe(201);
    expect((await importXml()).status).toBe(409);
  });
});