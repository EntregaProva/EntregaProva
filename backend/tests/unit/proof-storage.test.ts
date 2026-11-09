import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseProofStorage } from "../../src/services/proof-storage.js";
import { jpeg } from "../helpers.js";
import { createRuntimeProofStorage } from "../../src/config/proof-storage.js";

function fixture() {
  const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
  const client = createClient("https://synthetic.supabase.co", "backend-synthetic-secret", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
  });
  return { transport, storage: createSupabaseProofStorage(client, "comprovantes") };
}
const failure = (code: string, status: number) => Response.json({ code, message: "synthetic", statusCode: String(status) }, { status });
const path = "tenants/tenant-a/deliveries/123/proofs/hash";

describe("Adaptador Supabase com SDK real e transporte HTTP simulado", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("envia bytes sem sobrescrever, reutiliza só duplicatas e propaga falhas", async () => {
    const { transport, storage } = fixture();
    transport.mockResolvedValueOnce(Response.json({ Key: path, Id: "synthetic-id" }));
    await storage.uploadIfAbsent(path, jpeg, "image/jpeg");
    const [url, init] = transport.mock.calls[0];
    expect(String(url)).toContain(`/storage/v1/object/comprovantes/${path}`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("x-upsert")).toBe("false");
    expect(new Headers(init?.headers).get("content-type")).toBe("image/jpeg");
    expect(init?.body).toEqual(jpeg);
    transport.mockResolvedValueOnce(failure("ResourceAlreadyExists", 409));
    await expect(storage.uploadIfAbsent(path, jpeg, "image/jpeg")).resolves.toBeUndefined();
    transport.mockResolvedValueOnce(failure("AccessDenied", 403));
    await expect(storage.uploadIfAbsent(path, jpeg, "image/jpeg")).rejects.toMatchObject({ status: 403 });
  });

  it("distingue foto removida de bucket inexistente e credencial inválida", async () => {
    const { transport, storage } = fixture();
    transport.mockResolvedValueOnce(Response.json({ id: "synthetic-id" }));
    expect(await storage.exists(path)).toBe(true);
    transport.mockResolvedValueOnce(failure("NoSuchKey", 404));
    expect(await storage.exists(path)).toBe(false);
    for (const [code, status] of [["NoSuchBucket", 404], ["InvalidJWT", 401], ["InternalError", 500]] as const) {
      transport.mockResolvedValueOnce(failure(code, status));
      await expect(storage.exists(path)).rejects.toMatchObject({ code });
    }
    transport.mockRejectedValueOnce(new Error("offline"));
    await expect(storage.exists(path)).rejects.toThrow();
  });

  it("gera URL temporária por até 15 minutos e propaga erro de assinatura", async () => {
    const { transport, storage } = fixture();
    transport.mockResolvedValueOnce(Response.json({ signedURL: "/object/sign/comprovantes/synthetic?token=fake" }));
    expect(await storage.signedUrl(path, Date.now() + 900_000)).toContain("/storage/v1/object/sign/");
    const sent = JSON.parse(String(transport.mock.calls[0][1]?.body));
    expect(sent.expiresIn).toBeGreaterThanOrEqual(899);
    expect(sent.expiresIn).toBeLessThanOrEqual(900);
    transport.mockResolvedValueOnce(failure("AccessDenied", 403));
    await expect(storage.signedUrl(path, Date.now() + 900_000)).rejects.toMatchObject({ status: 403 });
  });

  it("produção recusa bucket público ou sem restrições antes de iniciar o servidor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROOF_STORAGE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "backend-synthetic-secret");
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "comprovantes");
    const valid = { public: false, file_size_limit: 300_000, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] };
    for (const body of [{ ...valid, public: true }, { ...valid, file_size_limit: null }, { ...valid, allowed_mime_types: ["*/*"] }]) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
      await expect(createRuntimeProofStorage()).rejects.toThrow("Bucket Supabase");
    }
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(valid)));
    await expect(createRuntimeProofStorage()).resolves.toHaveProperty("uploadIfAbsent");
  });
});
