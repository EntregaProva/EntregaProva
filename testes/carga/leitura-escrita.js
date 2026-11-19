import http from "k6/http";
import { check, fail, sleep } from "k6";
import exec from "k6/execution";

const API_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_URL = __ENV.AUTH_EMULATOR_URL || "http://localhost:9099";
const LOCAL_URL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const garantirAmbienteSeguro = (url) => {
  const ehLocal = LOCAL_URL_PATTERN.test(url);
  if (!ehLocal && __ENV.ALLOW_REMOTE !== "1") {
    throw new Error(`BASE_URL=${url} não é local. Este teste grava dados; use só contra emuladores.`);
  }
};

garantirAmbienteSeguro(API_URL);

export const options = {
  scenarios: {
    leitura: {
      executor: "constant-vus",
      exec: "leitura",
      vus: 10,
      duration: "60s",
      tags: { tipo: "leitura" },
    },
    escrita: {
      executor: "constant-vus",
      exec: "escrita",
      vus: 3,
      duration: "60s",
      tags: { tipo: "escrita" },
    },
  },
  thresholds: {
    "http_req_duration{tipo:leitura}": ["p(95)<800"],
    "http_req_duration{tipo:escrita}": ["p(95)<1500"],
    "checks{tipo:leitura}": ["rate>0.99"],
    "checks{tipo:escrita}": ["rate>0.99"],
  },
};

// Gera chave de 44 dígitos com DV módulo 11 válido (mesma regra do nfeKeyValidator.ts)
const gerarChaveNFe = (sequencial) => {
  const prefixo = "3526111234567800019555001";
  const base = `${prefixo}${String(sequencial).padStart(18, "0")}`.slice(0, 43);

  const soma = [...base]
    .reverse()
    .reduce((acc, digito, idx) => acc + Number(digito) * ((idx % 8) + 2), 0);

  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;

  return `${base}${dv}`;
};

const montarXmlNFe = (chave) => {
  const numeroNota = Number(chave.slice(25, 34));
  const digitoVerificador = chave[43];

  return `
    <NFe>
      <infNFe Id="NFe${chave}" versao="4.00">
        <ide>
          <nNF>${numeroNota}</nNF>
          <cDV>${digitoVerificador}</cDV>
        </ide>
        <emit><xNome>EMITENTE CARGA</xNome></emit>
        <dest><xNome>DESTINATARIO CARGA</xNome></dest>
        <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
      </infNFe>
    </NFe>
  `.trim();
};

const headersJson = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const login = (email) => {
  const res = http.post(
    `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    JSON.stringify({ email, password: "Teste@123", returnSecureToken: true }),
    { headers: headersJson(), tags: { tipo: "setup" } }
  );

  if (res.status !== 200) {
    fail(`Login de ${email} falhou (${res.status}). Você rodou o seed?`);
  }

  return res.json("idToken");
};

const importarEntrega = (token, sequencial, tags) =>
  http.post(
    `${API_URL}/api/v1/entregas/xml`,
    JSON.stringify({ xmlContent: montarXmlNFe(gerarChaveNFe(sequencial)) }),
    { headers: headersJson(token), tags }
  );

// --- Ciclo de vida do teste k6 ---

export function setup() {
  const operador = login("seed-operator-a@example.test");
  const motorista = login("seed-driver-a1@example.test");
  const baseSequencial = (Date.now() % 1e9) * 100;

  Array.from({ length: 50 }, (_, i) =>
    importarEntrega(operador, baseSequencial + i, { tipo: "setup" })
  );

  return { operador, motorista, baseSequencial };
}

export function leitura(data) {
  // Distribui ~1/3 dos VUs como motorista e ~2/3 como operador
  const usarMotorista = exec.vu.idInTest % 3 === 0;
  const token = usarMotorista ? data.motorista : data.operador;

  const res = http.get(`${API_URL}/api/v1/entregas?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { tipo: "leitura", rota: "GET /api/v1/entregas" },
  });

  check(res, { "leitura 200": (r) => r.status === 200 }, { tipo: "leitura" });
  sleep(1);
}

export function escrita(data) {
  // Offset de 1000 evita colisão com os 50 registros criados no setup
  const sequencial = data.baseSequencial + 1000 + exec.scenario.iterationInTest;

  const res = importarEntrega(data.operador, sequencial, {
    tipo: "escrita",
    rota: "POST /api/v1/entregas/xml",
  });

  check(res, { "escrita 201": (r) => r.status === 201 }, { tipo: "escrita" });
  sleep(1);
}