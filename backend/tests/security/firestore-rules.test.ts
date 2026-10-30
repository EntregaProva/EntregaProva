import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const [host, port] = (emulator ?? "127.0.0.1:8080").split(":");

const entregas = "tenants/tenant-a/deliveries";

describe.skipIf(!emulator)("Security Rules deny-all (Firestore)", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-entregaprova",
      firestore: {
        rules: readFileSync(resolve(process.cwd(), "../firestore.rules"), "utf8"),
        host,
        port: Number(port),
      },
    });
  });

  afterAll(() => env.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${entregas}/d1`), { status: "pendente" });
    });
  });

  const anonimo = () => env.unauthenticatedContext().firestore();
  const logado = () =>
    env.authenticatedContext("user-1", { tenantId: "tenant-a", role: "operator" }).firestore();

  it("CT-14: Anônimo não lê documento", async () => {
    await assertFails(getDoc(doc(anonimo(), `${entregas}/d1`)));
  });

  it("CT-15: Anônimo não escreve", async () => {
    await assertFails(setDoc(doc(anonimo(), `${entregas}/d2`), { status: "pendente" }));
  });

  it("CT-16: Autenticado não lê documento nem lista a coleção", async () => {
    await assertFails(getDoc(doc(logado(), `${entregas}/d1`)));
    await assertFails(getDocs(collection(logado(), entregas)));
  });

  it("CT-17: Autenticado não cria nem altera", async () => {
    await assertFails(setDoc(doc(logado(), `${entregas}/d2`), { status: "pendente" }));
    await assertFails(setDoc(doc(logado(), `${entregas}/d1`), { status: "conferida" }));
  });

  it("CT-18: Autenticado não apaga", async () => {
    await assertFails(deleteDoc(doc(logado(), `${entregas}/d1`)));
  });
});