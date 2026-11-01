import { vi } from "vitest";
import { DocumentData } from "firebase-admin/firestore";
import { AppDependencies } from "../src/dependencies.js";
import { createApp } from "../src/app.js";

export const key = "35231012345678000195550010000001011234567891";
export const xml = (version = "4.00", accessKey = key) =>
  `<NFe><infNFe Id="NFe${accessKey}" versao="${version}"><ide><nNF>1</nNF><cDV>${accessKey[43]}</cDV></ide><dest><xNome>DESTINATARIO SINTETICO</xNome></dest><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe>`;
export const path = (tenant = "tenant-a", id = key) => `tenants/${tenant}/deliveries/${id}`;
export const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 255, 217]);

export function fixture() {
  const documents = new Map<string, DocumentData>();
  const objects = new Map<string, Buffer>();
  const users: Record<string, { uid: string; tenantId?: unknown; role?: unknown }> = {
    operator: { uid: "operator-a", tenantId: "tenant-a", role: "operator" },
    driver: { uid: "driver-a", tenantId: "tenant-a", role: "driver" },
    otherDriver: { uid: "driver-other", tenantId: "tenant-a", role: "driver" },
    otherTenant: { uid: "driver-b", tenantId: "tenant-b", role: "driver" },
    admin: { uid: "admin-a", tenantId: "tenant-a", role: "admin" },
  };
  const snapshot = (map: Map<string, DocumentData>, ref: { path: string }) => ({
    exists: map.has(ref.path), data: () => structuredClone(map.get(ref.path)),
  });
  const read = vi.fn(async (ref: { path: string }) => snapshot(documents, ref));
  const doc = (value: string) => ({ path: value, get: () => read({ path: value }) });
  // Serialized atomic transactions with rollback. This is a test double, not an emulator.
  let queue = Promise.resolve();
  const runTransaction = vi.fn((callback: (tx: unknown) => Promise<unknown>) => {
    const task = queue.then(async () => {
      const draft = new Map([...documents].map(([p, d]) => [p, structuredClone(d)]));
      const tx = {
        get: async (ref: { path: string }) => snapshot(draft, ref),
        create: (ref: { path: string }, value: DocumentData) => {
          if (draft.has(ref.path)) throw new Error("exists");
          draft.set(ref.path, structuredClone(value));
        },
        set: (ref: { path: string }, value: DocumentData) => draft.set(ref.path, structuredClone(value)),
        update: (ref: { path: string }, value: DocumentData) => {
          if (!draft.has(ref.path)) throw new Error("missing");
          draft.set(ref.path, { ...draft.get(ref.path), ...structuredClone(value) });
        },
      };
      const result = await callback(tx);
      documents.clear();
      draft.forEach((d, p) => documents.set(p, d));
      return result;
    });
    queue = task.then(() => undefined, () => undefined);
    return task;
  });
  const save = vi.fn(async (name: string, bytes: Buffer, _options: unknown) => {
    if (objects.has(name)) throw Object.assign(new Error("exists"), { code: 412 });
    objects.set(name, bytes);
  });
  const sign = vi.fn(async (_name: string, _options: unknown) => ["https://storage.example/proof?signed=secret"]);
  const verifyIdToken = vi.fn(async (token: string) => {
    if (!users[token]) throw new Error("invalid token");
    return users[token];
  });
  const logger = { info: vi.fn(), error: vi.fn() };
  const deps = {
    auth: { verifyIdToken }, db: { doc, runTransaction },
    storage: { bucket: () => ({ file: (name: string) => ({
      save: (bytes: Buffer, options: unknown) => save(name, bytes, options),
      getSignedUrl: (options: unknown) => sign(name, options),
    }) }) }, logger,
  } as unknown as AppDependencies;
  const seed = (tenant = "tenant-a", driverId = "driver-a") =>
    documents.set(path(tenant), { status: "PENDENTE", driverId, chaveNFe: key });
  return { app: createApp(deps), deps, documents, objects, users, read, runTransaction, save, sign, logger, seed };
}
