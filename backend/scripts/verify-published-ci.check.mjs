import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { obtainTokens } from "./verify-published-ci.mjs";

const ROLES = ["OPERATOR", "DRIVER", "OTHER_DRIVER", "OTHER_TENANT"];

function makeEnv(overrides = {}) {
  const env = {
    FIREBASE_WEB_API_KEY: "test-api-key",
    GITHUB_ACTIONS: "true",
  };

  for (const role of ROLES) {
    env[`TEST_${role}_EMAIL`] = `${role.toLowerCase()}@test.local`;
    env[`TEST_${role}_PASSWORD`] = `pass-${role}`;
  }

  return { ...env, ...overrides };
}

const noop = () => {};

describe("obtainTokens", () => {
  it("autentica todos os perfis e mascara os tokens no GitHub Actions", async () => {
    const env = makeEnv();
    const calls = [];
    const logs = [];

    const fakeFetch = async (url, options) => {
      const idx = calls.length;
      calls.push({ url: String(url), options });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          idToken: `jwt.token.${idx}`,
          refreshToken: "refresh-123",
        }),
      };
    };

    const tokens = await obtainTokens(env, fakeFetch, (msg) => logs.push(msg));

    assert.equal(calls.length, 4);

    ROLES.forEach((role, i) => {
      const { url, options } = calls[i];
      const expectedToken = `jwt.token.${i}`;

      assert.equal(
        url,
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`,
      );
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.deepEqual(JSON.parse(options.body), {
        email: env[`TEST_${role}_EMAIL`],
        password: env[`TEST_${role}_PASSWORD`],
        returnSecureToken: true,
      });

      assert.equal(tokens[`TEST_${role}_TOKEN`], expectedToken);
      assert.equal(logs[i * 2], `::add-mask::${expectedToken}`);
      assert.match(logs[i * 2 + 1], /^Autenticado:/);
    });

    const fullLog = logs.join("\n");
    assert.ok(!fullLog.includes("pass-"));
    assert.ok(!fullLog.includes(env.FIREBASE_WEB_API_KEY));
  });

  it("não emite ::add-mask:: quando roda fora do GitHub Actions", async () => {
    const env = makeEnv({ GITHUB_ACTIONS: "false" });
    const logs = [];

    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ idToken: "jwt.token.local" }),
    });

    await obtainTokens(env, fakeFetch, (msg) => logs.push(msg));

    assert.equal(logs.length, 4);
    assert.ok(!logs.some((msg) => msg.includes("::add-mask::")));
  });

  it("falha sem chamar a rede se faltar a chave do Firebase", async () => {
    const env = makeEnv({ FIREBASE_WEB_API_KEY: "" });
    let called = false;

    await assert.rejects(
      obtainTokens(env, async () => { called = true; }, noop),
      /Variável obrigatória não definida: FIREBASE_WEB_API_KEY/,
    );

    assert.equal(called, false);
  });

  it("valida todas as credenciais antes de chamar a rede", async () => {
    const env = makeEnv({ TEST_OTHER_TENANT_PASSWORD: "" });
    let calls = 0;

    await assert.rejects(
      obtainTokens(env, async () => { calls++; }, noop),
      /Variável obrigatória não definida: TEST_OTHER_TENANT_PASSWORD/,
    );

    assert.equal(calls, 0);
  });

  it("interrompe imediatamente quando o login retorna erro HTTP", async () => {
    let calls = 0;

    const fakeFetch = async () => {
      calls++;
      return { ok: false, status: 400 };
    };

    await assert.rejects(
      obtainTokens(makeEnv(), fakeFetch, noop),
      /Falha no login \(operador\): HTTP 400/,
    );

    assert.equal(calls, 1);
  });

  it("não expõe detalhes internos da falha de conexão", async () => {
    const fakeFetch = async () => {
      throw new Error("detalhe-sensivel-que-nao-deve-aparecer");
    };

    await assert.rejects(
      obtainTokens(makeEnv(), fakeFetch, noop),
      { message: "Erro de conexão ao autenticar operador" },
    );
  });

  it("rejeita resposta sem idToken no payload", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({}),
    });

    await assert.rejects(
      obtainTokens(makeEnv(), fakeFetch, noop),
      /Token ausente ou malformado para operador/,
    );
  });

  it("preserva espaços que fazem parte da senha", async () => {
    const env = makeEnv({ TEST_OPERATOR_PASSWORD: " senha com espaços " });
    const passwords = [];

    await obtainTokens(env, async (_url, options) => {
      passwords.push(JSON.parse(options.body).password);
      return {
        ok: true,
        json: async () => ({ idToken: "jwt.token.synthetic" }),
      };
    }, noop);

    assert.equal(passwords[0], " senha com espaços ");
  });

  it("recusa resposta JSON inválida sem expor o erro interno", async () => {
    await assert.rejects(
      obtainTokens(makeEnv(), async () => ({
        ok: true,
        json: async () => { throw new Error("detalhe-sensivel"); },
      }), noop),
      { message: "Resposta de autenticação inválida para operador" },
    );
  });

  it("recusa tokens malformados antes de emitir logs", async () => {
    for (const idToken of ["tok", 123, "a.b.c\ncomando"]) {
      const logs = [];

      await assert.rejects(
        obtainTokens(makeEnv(), async () => ({
          ok: true,
          json: async () => ({ idToken }),
        }), message => logs.push(message)),
        { message: "Token ausente ou malformado para operador" },
      );

      assert.deepEqual(logs, []);
    }
  });
});