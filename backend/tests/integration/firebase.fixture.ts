import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createApp } from "../../src/app.js";
import { vi } from "vitest";

export const emulatorsReady = ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]
  .every(key => Boolean(process.env[key]));

export async function emulatorFixture() {
  if (!emulatorsReady) throw new Error("Auth, Firestore e Storage emulados são obrigatórios");
  const run = randomUUID();
  const firebase = initializeApp({ projectId: "demo-entregaprova", storageBucket: "demo-entregaprova.appspot.com" }, `cp3-${run}`);
  const auth = getAuth(firebase);
  const db = getFirestore(firebase);
  const storage = getStorage(firebase);
  const tenant = `it-${run}`;
  const otherTenant = `other-${run}`;
  const tokens: Record<string, string> = {};
  const users = [
    { name: "operator", role: "operator", tenantId: tenant },
    { name: "driver", role: "driver", tenantId: tenant },
    { name: "otherDriver", role: "driver", tenantId: tenant },
    { name: "otherTenant", role: "operator", tenantId: otherTenant },
  ];
  for (const user of users) {
    const uid = `${user.name}-${run}`;
    const email = `${uid}@example.test`;
    await auth.createUser({ uid, email, password: "Teste@123" });
    await auth.setCustomUserClaims(uid, { role: user.role, tenantId: user.tenantId });
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Teste@123", returnSecureToken: true }),
    });
    if (!response.ok) throw new Error(`Login de teste falhou (${response.status})`);
    tokens[user.name] = (await response.json() as { idToken: string }).idToken;
  }
  const signer = vi.fn(async (_path: string, _expires: number) => "https://signer-test.invalid/proof");
  const app = createApp({ auth, db, storage, proofUrlSigner: signer, logger: { info: vi.fn(), error: vi.fn() } });
  const clear = async () => {
    await Promise.all([db.recursiveDelete(db.doc(`tenants/${tenant}`)), db.recursiveDelete(db.doc(`tenants/${otherTenant}`))]);
    for (const tenantId of [tenant, otherTenant]) {
      const [files] = await storage.bucket().getFiles({ prefix: `tenants/${tenantId}/` });
      await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })));
    }
  };
  return {
    app, db, storage, tenant, otherTenant, tokens, signer, driverId: `driver-${run}`, clear,
    async dispose() {
      await clear();
      await auth.deleteUsers(users.map(user => `${user.name}-${run}`));
      await db.terminate();
      await deleteApp(firebase);
    },
  };
}
