import { auth } from "../firebase.ts";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api/v1";
const COLD_START_WINDOW_MS = 10_000;
const RETRYABLE_GET_STATUSES = new Set([500, 502, 503, 504]);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MENSAGEM_POR_STATUS: Record<number, string> = {
  401: "Sua sessão expirou. Entre novamente.",
  403: "Você não tem permissão para fazer isso.",
  404: "Não encontramos o que você procurou.",
  413: "Arquivo grande demais.",
  415: "Tipo de arquivo não aceito.",
  500: "O servidor teve um problema. Tente de novo em instantes.",
  502: "O servidor está indisponível. Tente de novo em instantes.",
  503: "O servidor está indisponível. Tente de novo em instantes.",
  504: "O servidor está demorando para responder. Tente de novo em instantes.",
};

async function mensagemDeErro(res: Response): Promise<string> {
  const padrao = MENSAGEM_POR_STATUS[res.status];
  if (padrao) return padrao;
  try {
    const corpo: unknown = await res.json();
    if (corpo && typeof corpo === "object") {
      const objeto = corpo as Record<string, unknown>;
      for (const chave of ["message", "detail", "error"]) {
        const valor = objeto[chave];
        if (typeof valor === "string" && valor) return valor;
      }
    }
  } catch {
    // resposta sem JSON: usa a mensagem genérica abaixo
  }
  return `Não foi possível concluir (código ${res.status}).`;
}

export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.message;
  return "Algo deu errado. Tente novamente.";
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchDuranteColdStart(url: string, init: RequestInit, headers: Headers): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  // Only safe reads can be retried; preserve caller cancellation semantics too.
  if (method !== "GET" || init.signal) return fetch(url, { ...init, headers });

  const deadline = Date.now() + COLD_START_WINDOW_MS;
  let delay = 300;
  let lastTransientStatus: number | null = null;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), Math.min(remaining, 2500));
    try {
      const response = await fetch(url, { ...init, headers, signal: controller.signal });
      if (!RETRYABLE_GET_STATUSES.has(response.status)) return response;
      lastTransientStatus = response.status;
      await response.body?.cancel().catch(() => undefined);
    } catch {
      // Network failures and per-attempt timeouts can happen while the API starts.
    } finally {
      window.clearTimeout(timeout);
    }
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;
    await esperar(Math.min(delay, timeLeft));
    delay = Math.min(Math.round(delay * 1.7), 1600);
  }
  throw new ApiError(lastTransientStatus ?? 0, "A API não respondeu em até 10 segundos. Tente novamente.");
}

// Chama a API enviando o token do Firebase em todas as requisições.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetchDuranteColdStart(`${API_URL}${API_PREFIX}${path}`, init, headers);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Não foi possível falar com o servidor. Verifique se a API está rodando.");
  }
  if (!res.ok) throw new ApiError(res.status, await mensagemDeErro(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
