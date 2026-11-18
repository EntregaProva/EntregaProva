import { smoke } from "./smoke.mjs";

// Read-only acceptance: tokens belong to synthetic homologation users.
try {
  const required = ["TARGET_API_URL", "TEST_OPERATOR_TOKEN", "TEST_DRIVER_TOKEN", "TEST_OTHER_DRIVER_TOKEN", "TEST_OTHER_TENANT_TOKEN", "TEST_DELIVERY_ID"];
  for (const name of required) if (!process.env[name]) throw new Error(`Configure ${name}`);
  if (!/^\d{44}$/.test(process.env.TEST_DELIVERY_ID)) throw new Error("Identificador de homologação inválido");
  const base = process.env.TARGET_API_URL.replace(/\/$/, "");
  console.log(JSON.stringify(await smoke(base, process.env.EXPECTED_API_REVISION)));
  const detail = `/api/v1/entregas/${process.env.TEST_DELIVERY_ID}`;
  const cases = [
    ["sem token", "/api/v1/entregas", undefined, 401],
    ["token inválido", "/api/v1/entregas", "invalid-token", 401],
    ["listagem operador", "/api/v1/entregas", process.env.TEST_OPERATOR_TOKEN, 200],
    ["listagem motorista", "/api/v1/entregas", process.env.TEST_DRIVER_TOKEN, 200],
    ["detalhe atribuído", detail, process.env.TEST_DRIVER_TOKEN, 200],
    ["outro motorista", detail, process.env.TEST_OTHER_DRIVER_TOKEN, 403],
    ["outro tenant", detail, process.env.TEST_OTHER_TENANT_TOKEN, 404],
  ];
  for (const [name, path, token, expected] of cases) {
    const response = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (response.status !== expected || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`${name}: resposta inesperada (${response.status})`);
    const body = await response.json();
    if (name.startsWith("listagem") && !Array.isArray(body.itens)) throw new Error(`${name}: contrato de listagem inesperado`);
    if (name === "listagem motorista") {
      const payload = JSON.parse(Buffer.from(process.env.TEST_DRIVER_TOKEN.split(".")[1], "base64url").toString());
      if (body.itens.some(item => item.driverId !== payload.sub)) throw new Error("Listagem retornou entrega de outro motorista");
    }
    console.log(JSON.stringify({ test: name, status: response.status }));
  }
  const forbidden = await fetch(`${base}${detail}/conferencia`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.TEST_DRIVER_TOKEN}`, "Content-Type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(15_000), redirect: "error",
  });
  if (forbidden.status !== 403) throw new Error("Motorista não deve poder conferir");
  console.log(JSON.stringify({ test: "papel proibido na conferência", status: forbidden.status }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
