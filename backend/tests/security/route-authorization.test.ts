import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { fixture, key } from "../helpers.js";

const ROLES = ["admin", "operator", "driver", "financeiro"] as const;
type Role = (typeof ROLES)[number];

// Rotas públicas e o motivo de não exigirem autenticação
const PUBLIC_ROUTES: Record<string, string> = {
  "GET /": "mensagem de API ativa, sem dados",
  "GET /healthz": "health check do Render e do smoke",
  "GET /readyz": "readiness do Render e do smoke",
  "GET /api/v1/health": "alias do health check",
  "GET /api/v1/healthz": "alias do health check",
  "GET /api/v1/readyz": "alias do readiness",
  "POST /api/v1/cadastros": "cadastro público com confirmação de e-mail",
  "POST /api/v1/convites/aceitar": "valida o token e o e-mail verificado sem exigir vínculo prévio",
  "GET /api/v1/pacotes-comprovacao/:id/arquivo": "download por capability de curta duração",
};

const PROTECTED_ROUTES: Record<string, Role[]> = {
  
  "POST /api/v1/usuarios": ["admin"],

  "POST /api/v1/pacotes-comprovacao": ["admin", "operator", "financeiro"],
  "GET /api/v1/pacotes-comprovacao/:id": ["admin", "operator", "financeiro"],

  "GET /api/v1/entregas": ["admin", "operator", "driver"],
  "GET /api/v1/deliveries": ["admin", "operator", "driver"],
  "GET /api/v1/entregas/:id": ["admin", "operator", "driver"],
  "GET /api/v1/deliveries/:id": ["admin", "operator", "driver"],
  "POST /api/v1/entregas/xml": ["admin", "operator"],
  "POST /api/v1/deliveries/xml": ["admin", "operator"],
  "POST /api/v1/entregas/:id/comprovantes": ["driver", "admin"],
  "POST /api/v1/deliveries/:id/proof": ["driver", "admin"],
  "POST /api/v1/entregas/:id/conferencia": ["admin", "operator"],
  "PATCH /api/v1/deliveries/:id/check": ["admin", "operator"],
};

type RouterLayer = {
  name?: string;
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: RouterLayer[] };
};

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

// Extrai todas as rotas registradas no Express (sem mutação)
const getAppRoutes = (app: Express): string[] => {
  const rootStack = (app as unknown as { _router?: { stack?: RouterLayer[] } })._router?.stack ?? [];

  const collect = (stack: RouterLayer[], prefix: string): string[] =>
    stack.flatMap((layer) => {
      if (layer.route) {
        const paths = [layer.route.path].flat();
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        return methods.flatMap((method) => paths.map((path) => `${method} ${prefix}${path}`));
      }

      // Express 4 não expõe o prefixo do sub-router; o único da aplicação é /api/v1 (ver app.ts)
      if (layer.name === "router" && layer.handle?.stack) {
        return collect(layer.handle.stack, "/api/v1");
      }

      return [];
    });

  return collect(rootStack, "");
};

const requestRoute = (app: Express, route: string, token?: string) => {
  const [rawMethod, rawPath] = route.split(" ");
  const method = rawMethod.toLowerCase() as HttpMethod;
  const path = rawPath.replace(":id", key);
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const verifyAll = async <T>(items: T[], check: (item: T) => Promise<void>) => {
  for (const item of items) {
    await check(item);
  }
};

describe("CT-AUTHZ-ROTAS: inventário de autorização das rotas", () => {
  const protectedEntries = Object.entries(PROTECTED_ROUTES);
  const protectedRoutes = Object.keys(PROTECTED_ROUTES);

  let ctx: ReturnType<typeof fixture>;

  beforeEach(() => {
    ctx = fixture();
    ctx.users.financeiro = { uid: "financeiro-a", tenantId: "tenant-a", role: "financeiro" };
    ctx.seed();
  });

  it("CT-AUTHZ-01: toda rota registrada está na matriz e nenhuma rota obsoleta sobrou", () => {
    const registered = getAppRoutes(ctx.app);
    const documented = new Set([...Object.keys(PUBLIC_ROUTES), ...protectedRoutes]);

    const undocumented = registered.filter((route) => !documented.has(route));
    const stale = [...documented].filter((route) => !registered.includes(route));

    expect(registered.length).toBeGreaterThan(0);
    expect(undocumented, "Rotas novas sem classificação").toEqual([]);
    expect(stale, "Rotas na matriz que não existem mais").toEqual([]);
  });

  it("CT-AUTHZ-02: rota protegida sem token devolve 401", async () => {
    await verifyAll(protectedRoutes, async (route) => {
      const res = await requestRoute(ctx.app, route);
      expect(res.status, route).toBe(401);
    });
  });

  it("CT-AUTHZ-03: rota protegida com token inválido devolve 401", async () => {
    await verifyAll(protectedRoutes, async (route) => {
      const res = await requestRoute(ctx.app, route, "token-inexistente");
      expect(res.status, route).toBe(401);
    });
  });

  it("CT-AUTHZ-04: papel sem permissão na matriz recebe 403", async () => {
    const unauthorizedCases = protectedEntries.flatMap(([route, allowed]) =>
      ROLES.filter((role) => !allowed.includes(role)).map((role) => ({ route, role }))
    );

    await verifyAll(unauthorizedCases, async ({ route, role }) => {
      const res = await requestRoute(ctx.app, route, role);
      expect(res.status, `${role} em ${route}`).toBe(403);
    });
  });

  it("CT-AUTHZ-05: papel permitido passa pela autorização (nem 401 nem 403)", async () => {
    const authorizedCases = protectedEntries.flatMap(([route, allowed]) =>
      allowed.map((role) => ({ route, role }))
    );

    await verifyAll(authorizedCases, async ({ route, role }) => {
      const res = await requestRoute(ctx.app, route, role);
      expect([401, 403], `${role} em ${route} retornou ${res.status}`).not.toContain(res.status);
    });
  });

  it("CT-AUTHZ-06: token sem tenant ou com papel inventado recebe 403", async () => {
    ctx.users.semTenant = { uid: "x", role: "operator" };
    ctx.users.papelInventado = { uid: "y", tenantId: "tenant-a", role: "superuser" };

    await verifyAll(protectedRoutes, async (route) => {
      const noTenant = await requestRoute(ctx.app, route, "semTenant");
      const badRole = await requestRoute(ctx.app, route, "papelInventado");

      expect(noTenant.status, `semTenant em ${route}`).toBe(403);
      expect(badRole.status, `papelInventado em ${route}`).toBe(403);
    });
  });
});
