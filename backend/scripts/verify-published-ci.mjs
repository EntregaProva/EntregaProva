import { pathToFileURL } from "node:url";

const ROLES = {
  OPERATOR: "operador",
  DRIVER: "motorista responsável",
  OTHER_DRIVER: "outro motorista",
  OTHER_TENANT: "usuário de outro tenant",
};

const FIREBASE_AUTH_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

function getEnv(name, env = process.env) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Variável obrigatória não definida: ${name}`);
  }
  return value;
}

export async function obtainTokens(
  env = process.env,
  fetcher = fetch,
  log = console.log,
) {
  const apiKey = getEnv("FIREBASE_WEB_API_KEY", env);
  const url = new URL(FIREBASE_AUTH_URL);
  url.searchParams.set("key", apiKey);

  const accounts = Object.entries(ROLES).map(([role, label]) => ({
    role,
    label,
    email: getEnv(`TEST_${role}_EMAIL`, env),
    password: getEnv(`TEST_${role}_PASSWORD`, env),
  }));

  const tokens = {};

  for (const { role, label, email, password } of accounts) {
    let res;
    try {
      res = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
    } catch {
      throw new Error(`Erro de conexão ao autenticar ${label}`);
    }

    if (!res.ok) {
      throw new Error(`Falha no login (${label}): HTTP ${res.status}`);
    }

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Resposta de autenticação inválida para ${label}`);
    }

    const idToken = body?.idToken;
    if (
      typeof idToken !== "string" ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)
    ) {
      throw new Error(`Token ausente ou malformado para ${label}`);
    }

    if (env.GITHUB_ACTIONS === "true") {
      log(`::add-mask::${idToken}`);
    }

    tokens[`TEST_${role}_TOKEN`] = idToken;
    log(`Autenticado: ${label}`);
  }

  return tokens;
}

async function run() {
  const targetUrl = getEnv("TARGET_API_URL");
  const deliveryId = getEnv("TEST_DELIVERY_ID");
  const revision = getEnv("EXPECTED_API_REVISION");

  if (!targetUrl.startsWith("https://")) {
    throw new Error("TARGET_API_URL deve usar HTTPS");
  }

  if (!/^\d{44}$/.test(deliveryId)) {
    throw new Error("TEST_DELIVERY_ID inválido (esperado 44 dígitos)");
  }

  if (!/^[a-f0-9]{40}$/i.test(revision)) {
    throw new Error("EXPECTED_API_REVISION deve ser um SHA de 40 caracteres");
  }

  const tokens = await obtainTokens();
  Object.assign(process.env, tokens);

  await import("./verify-published.mjs");
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  run().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}