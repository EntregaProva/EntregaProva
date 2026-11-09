import { pathToFileURL } from "node:url";
import { smoke } from "./smoke.mjs";

export async function deployRender(env = process.env, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!env.RENDER_DEPLOY_HOOK_URL || !env.TARGET_API_URL || !/^[a-f0-9]{40}$/.test(env.EXPECTED_API_REVISION || "")) {
    throw new Error("Configure RENDER_DEPLOY_HOOK_URL, API_BASE_URL e o SHA esperado");
  }
  const hook = new URL(env.RENDER_DEPLOY_HOOK_URL);
  if (hook.origin !== "https://api.render.com" || !hook.pathname.startsWith("/deploy/") || !hook.searchParams.get("key")) {
    throw new Error("Deploy hook do Render inválido");
  }
  hook.searchParams.set("ref", env.EXPECTED_API_REVISION);
  let response;
  try {
    response = await fetcher(hook, { method: "POST", signal: AbortSignal.timeout(30_000), redirect: "error" });
  } catch {
    throw new Error("Falha ao solicitar deploy no Render; verifique o hook secreto");
  }
  if (![200, 202].includes(response.status)) throw new Error(`Render recusou deploy (HTTP ${response.status})`);
  const deadline = Date.now() + 15 * 60_000;
  for (let attempt = 0; attempt < 90 && Date.now() < deadline; attempt++) {
    try { return await smoke(env.TARGET_API_URL, env.EXPECTED_API_REVISION, fetcher); }
    catch { if (attempt < 89) await wait(10_000); }
  }
  throw new Error("A API Render não confirmou health/readiness e SHA esperado dentro do prazo");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await deployRender())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
