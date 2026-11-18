import { pathToFileURL } from "node:url";

export async function cleanupProofs(client, bucket, { apply = false, now = Date.now() } = {}) {
  const { data: config, error: bucketError } = await client.storage.getBucket(bucket);
  if (bucketError || !config || config.public) throw new Error("Bucket privado indisponível");
  const files = client.storage.from(bucket);
  const cutoff = now - 60 * 24 * 60 * 60 * 1000;
  const expired = [];
  const walk = async prefix => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await files.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data) throw new Error("Falha ao listar comprovantes; limpeza interrompida");
      for (const item of data) {
        const path = `${prefix}/${item.name}`;
        if (item.name.includes("/") || item.name === "." || item.name === "..") throw new Error("Caminho de arquivo inválido");
        if (!item.id) {
          if (path.split("/").length < 6) await walk(path);
        } else if (/^tenants\/[A-Za-z0-9_-]{1,128}\/deliveries\/\d{44}\/proofs\/[a-f0-9]{64}$/.test(path) && Date.parse(item.created_at) < cutoff) {
          expired.push(path);
        }
      }
      if (data.length < 1000) break;
    }
  };
  await walk("tenants");
  if (apply) {
    for (let offset = 0; offset < expired.length; offset += 100) {
      const { error } = await files.remove(expired.slice(offset, offset + 100));
      if (error) throw new Error("Falha ao remover lote de comprovantes");
    }
  }
  return { mode: apply ? "apply" : "dry-run", retentionDays: 60, expired: expired.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { readProofStorageConfig } = await import("../dist/config/runtime.js");
    const config = readProofStorageConfig({ ...process.env, PROOF_STORAGE_PROVIDER: "supabase" });
    const client = createClient(config.url, config.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
    });
    console.log(JSON.stringify(await cleanupProofs(client, config.bucket, { apply: process.argv.includes("--apply") })));
  } catch {
    console.error("Limpeza falhou. Verifique build, credenciais, bucket e permissões; nenhum segredo é exibido.");
    process.exitCode = 1;
  }
}
