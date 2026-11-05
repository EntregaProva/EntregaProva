import { pathToFileURL } from "node:url";

export async function smoke(base, expectedRevision, fetcher = fetch) {
  const target = new URL(base);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new Error("URL de smoke inválida");
  const origin = target.href.replace(/\/$/, "");
  const result = [];
  for (const [path, status] of [["/healthz", "ok"], ["/readyz", "ready"]]) {
    const started = Date.now();
    const response = await fetcher(`${origin}${path}`, { signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (response.status !== 200 || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`${path}: HTTP/Content-Type inesperado (${response.status})`);
    const body = await response.json();
    if (body.status !== status || (path === "/healthz" && body.service !== "entregaprova-api")) throw new Error(`${path}: corpo inesperado`);
    if (path === "/healthz" && expectedRevision && body.revision !== expectedRevision) throw new Error("Smoke atingiu outra revisão");
    result.push({ path, status: response.status, durationMs: Date.now() - started });
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = process.argv[2] || process.env.CP3_TARGET_URL;
    if (!base) throw new Error("Informe URL candidata como argumento ou CP3_TARGET_URL");
    console.log(JSON.stringify(await smoke(base, process.argv[3] || process.env.CP3_EXPECTED_REVISION)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
