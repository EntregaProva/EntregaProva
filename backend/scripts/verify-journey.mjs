import { randomInt, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { smoke } from "./smoke.mjs";

function claims(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

function notaSintetica() {
  const numero = randomInt(1, 1_000_000_000);
  const codigo = randomInt(1, 100_000_000);
  const base = `3526100000000000019155001${String(numero).padStart(9, "0")}1${String(codigo).padStart(8, "0")}`;
  const soma = [...base].reverse().reduce((total, digito, i) => total + Number(digito) * (2 + i % 8), 0);
  const dv = soma % 11 < 2 ? 0 : 11 - soma % 11;
  const chave = `${base}${dv}`;
  const xmlContent = `<NFe><infNFe Id="NFe${chave}" versao="4.00"><ide><nNF>${numero}</nNF><cDV>${dv}</cDV></ide><emit><xNome>REMETENTE SINTETICO</xNome></emit><dest><xNome>DESTINATARIO SINTETICO</xNome></dest><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe>`;
  return { chave, xmlContent };
}

export async function verifyJourney(env = process.env, fetcher = fetch, log = console.log) {
  const { TARGET_API_URL, EXPECTED_API_REVISION, TEST_SMOKE_TENANT, TEST_OPERATOR_TOKEN, TEST_DRIVER_TOKEN } = env;
  if (env.SMOKE_WRITE_ENABLED !== "true" || !/^homologacao-[a-z0-9-]+$/.test(TEST_SMOKE_TENANT ?? "")) {
    throw new Error("Habilite a escrita apenas em um tenant dedicado de homologação");
  }
  if (!TARGET_API_URL || !/^[a-f0-9]{40}$/.test(EXPECTED_API_REVISION ?? "") || !TEST_OPERATOR_TOKEN || !TEST_DRIVER_TOKEN) {
    throw new Error("Informe a API, a revisão publicada e os dois tokens sintéticos");
  }
  const base = new URL(TARGET_API_URL);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Informe somente a origem HTTPS da API");
  }
  const operator = claims(TEST_OPERATOR_TOKEN);
  const driver = claims(TEST_DRIVER_TOKEN);
  if (operator.role !== "operator" || driver.role !== "driver" || !driver.sub ||
      operator.tenantId !== TEST_SMOKE_TENANT || driver.tenantId !== TEST_SMOKE_TENANT) {
    throw new Error("Os tokens devem ser de um operador e de um motorista do tenant sintético");
  }

  log(JSON.stringify(await smoke(base.origin, EXPECTED_API_REVISION, fetcher)));
  async function request(step, route, token, status, init) {
    const response = await fetcher(new URL(route, base), {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== status || !response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${step}: HTTP ${response.status}`);
    }
    log(`${step}: HTTP ${status}`);
    return response.json();
  }

  const { chave, xmlContent } = notaSintetica();
  const rota = `/api/v1/entregas/${chave}`;
  const json = { "Content-Type": "application/json" };
  await request("Importação", "/api/v1/entregas/xml", TEST_OPERATOR_TOKEN, 201, {
    method: "POST", headers: json, body: JSON.stringify({ xmlContent, driverId: driver.sub }),
  });
  const foto = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lmXQAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.set("recebedor", "RECEBEDOR SINTETICO");
  form.set("dataHora", new Date().toISOString());
  form.set("foto", new Blob([foto], { type: "image/png" }), "sintetico.png");
  await request("Envio de comprovante", `${rota}/comprovantes`, TEST_DRIVER_TOKEN, 200, {
    method: "POST", headers: { "Idempotency-Key": randomUUID() }, body: form,
  });
  const detail = await request("Detalhe da entrega", rota, TEST_OPERATOR_TOKEN, 200);
  const link = new URL(detail.comprovante?.arquivoUrl);
  if (detail.status !== "COMPROVADO" || !detail.comprovante?.arquivoDisponivel ||
      link.protocol !== "https:" || link.username || link.password) {
    throw new Error("Comprovante indisponível");
  }
  const download = await fetcher(link, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!download.ok || !Buffer.from(await download.arrayBuffer()).equals(foto)) {
    throw new Error("Os bytes recuperados diferem do comprovante enviado");
  }
  log("Leitura do comprovante: bytes conferidos");
  const result = await request("Conferência", `${rota}/conferencia`, TEST_OPERATOR_TOKEN, 200, {
    method: "POST", headers: json, body: JSON.stringify({ decisao: "APROVAR" }),
  });
  if (result.status !== "CONFERIDO") throw new Error("Estado final da entrega inesperado");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyJourney().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
