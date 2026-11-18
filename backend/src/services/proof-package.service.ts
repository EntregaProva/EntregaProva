import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { zipSync } from "fflate";
import type { AppDependencies } from "../dependencies.js";
import { HttpError } from "../utils/httpError.js";
import { hasValidProofSignature } from "../utils/proofFile.js";
import { MAX_PROOF_BYTES } from "../config/proof.js";

const LINK_MS = 15 * 60_000;
const LEASE_MS = 10 * 60_000;
const MAX_BYTES = 20 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};
interface PackageRequest {
  embarcadorId: string;
  entregaIds: string[];
  inicio?: string;
  fim?: string;
}
interface Entry {
  id: string;
  numeroNF: string;
  valorTotal: number;
  criadoEm: string;
  path: string;
  arquivo: string;
  sha256: string;
}
interface PackageJob extends PackageRequest {
  status: "PROCESSANDO" | "PRONTO" | "FALHOU";
  criadoEm: string;
  criadoPor: string;
  secret: string;
  owner?: string;
  leaseUntil?: number;
  entradas?: Entry[];
  erro?: string;
}
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export function parsePackageRequest(body: unknown): PackageRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Pedido inválido");
  const value = body as Record<string, unknown>;
  if (typeof value.embarcadorId !== "string" || !/^\d{14}$/.test(value.embarcadorId) ||
      !Array.isArray(value.entregaIds) || value.entregaIds.length < 1 || value.entregaIds.length > 200 ||
      value.entregaIds.some(id => typeof id !== "string" || !/^\d{44}$/.test(id)) ||
      new Set(value.entregaIds).size !== value.entregaIds.length) {
    throw new HttpError(400, "Informe CNPJ do embarcador e de 1 a 200 chaves únicas de 44 dígitos");
  }
  if (value.formato !== undefined && value.formato !== "ZIP") throw new HttpError(400, "Formato disponível: ZIP");
  const result: PackageRequest = { embarcadorId: value.embarcadorId, entregaIds: value.entregaIds };
  for (const field of ["inicio", "fim"] as const) {
    if (value[field] !== undefined) {
      const date = value[field];
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ||
          !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) {
        throw new HttpError(400, "Período deve usar instantes ISO UTC com milissegundos");
      }
      result[field] = date;
    }
  }
  if (Boolean(result.inicio) !== Boolean(result.fim) || (result.inicio && result.fim && result.inicio > result.fim)) {
    throw new HttpError(400, "Informe início e fim em ordem cronológica");
  }
  return result;
}

export function createProofPackageService(deps: AppDependencies) {
  let active = 0;
  let downloads = 0;
  const reference = (tenant: string, id: string) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenant) || !/^[a-f0-9-]{36}$/.test(id)) {
      throw new HttpError(400, "Identificador de pacote inválido");
    }
    return deps.db.doc(`tenants/${tenant}/proofPackages/${id}`);
  };
  async function read(tenant: string, id: string): Promise<PackageJob> {
    const snapshot = await reference(tenant, id).get();
    if (!snapshot.exists) throw new HttpError(404, "Pacote não encontrado");
    return snapshot.data() as PackageJob;
  }
  async function proof(path: string) {
    if (!await deps.proofStorage.exists(path)) throw new HttpError(410, "Comprovante indisponível ou expirado");
    const bytes = await deps.proofStorage.download(path);
    if (!bytes.length || bytes.length > MAX_PROOF_BYTES) throw new HttpError(413, "Comprovante acima do limite");
    const mime = Object.keys(extensions).find(type => hasValidProofSignature(type, bytes));
    if (!mime) throw new HttpError(422, "Formato de comprovante inválido");
    return { bytes, extension: extensions[mime] };
  }
  async function collect(tenant: string, job: PackageJob): Promise<Entry[]> {
    const entries: Entry[] = [];
    let total = 0;
    const deadline = Date.now() + 5 * 60_000;
    for (const id of job.entregaIds) {
      if (Date.now() > deadline) throw new HttpError(504, "Tempo de geração excedido");
      const delivery = (await deps.db.doc(`tenants/${tenant}/deliveries/${id}`).get()).data();
      if (!delivery) throw new HttpError(404, "Entrega não encontrada no tenant");
      if (id.slice(6, 20) !== job.embarcadorId) throw new HttpError(422, "Entrega de outro embarcador");
      if (delivery.status !== "CONFERIDO") throw new HttpError(409, "Somente entregas conferidas podem compor o pacote");
      if (typeof delivery.criadoEm !== "string" || !Number.isFinite(Date.parse(delivery.criadoEm)) ||
          (job.inicio && job.fim && (delivery.criadoEm < job.inicio || delivery.criadoEm > job.fim))) {
        throw new HttpError(422, "Entrega fora do período ou sem data de importação válida");
      }
      const path = delivery.comprovante?.arquivoPath;
      if (typeof path !== "string" || !path.startsWith(`tenants/${tenant}/deliveries/${id}/proofs/`)) {
        throw new HttpError(410, "Comprovante indisponível ou expirado");
      }
      const { bytes, extension } = await proof(path);
      total += bytes.length;
      if (total > MAX_BYTES) throw new HttpError(413, "Pacote excede 20 MiB; divida a seleção");
      entries.push({ id, numeroNF: String(delivery.numeroNF ?? ""), valorTotal: Number(delivery.valorTotal ?? 0),
        criadoEm: delivery.criadoEm, path, arquivo: `fotos/${id}.${extension}`, sha256: digest(bytes) });
    }
    return entries;
  }
  async function process(tenant: string, id: string) {
    const ref = reference(tenant, id);
    const owner = randomUUID();
    const job = await deps.db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data() as PackageJob | undefined;
      if (!data || data.status !== "PROCESSANDO" || (data.leaseUntil ?? 0) > Date.now()) return null;
      tx.update(ref, { owner, leaseUntil: Date.now() + LEASE_MS });
      return data;
    });
    if (!job) return;
    let update: Partial<PackageJob>;
    try {
      update = { status: "PRONTO", entradas: await collect(tenant, job) };
    } catch (error) {
      update = { status: "FALHOU", erro: error instanceof HttpError ? error.message : "Falha ao gerar pacote; solicite novamente" };
    }
    await deps.db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.owner === owner && current.status === "PROCESSANDO") tx.update(ref, { ...update, leaseUntil: 0 });
    });
  }
  function resume(tenant: string, id: string) {
    if (active >= 2) return;
    active++;
    // The Firestore lease allows polling to recover jobs after a server restart.
    setImmediate(() => { void process(tenant, id).catch(() => {
      deps.logger.error({ severity: "ERROR", event: "package_processing_failed", tenantId: tenant });
    }).finally(() => { active--; }); });
  }
  const signature = (job: PackageJob, tenant: string, id: string, expires: number) =>
    createHmac("sha256", job.secret).update(`${tenant}:${id}:${expires}`).digest("hex");

  return {
    async create(tenant: string, uid: string, body: unknown) {
      const input = parsePackageRequest(body);
      const id = randomUUID();
      const job: PackageJob = { ...input, status: "PROCESSANDO", criadoEm: new Date().toISOString(),
        criadoPor: uid, secret: randomBytes(32).toString("hex") };
      await reference(tenant, id).create(job);
      resume(tenant, id);
      return { id, embarcadorId: job.embarcadorId, status: job.status, criadoEm: job.criadoEm };
    },
    async get(tenant: string, id: string) {
      const job = await read(tenant, id);
      if (job.status === "PROCESSANDO") resume(tenant, id);
      const expires = Date.now() + LINK_MS;
      const query = new URLSearchParams({ tenant, expires: String(expires), signature: signature(job, tenant, id, expires) });
      return { id, embarcadorId: job.embarcadorId, status: job.status, criadoEm: job.criadoEm,
        quantidadeEntregas: job.entradas?.length ?? 0, erro: job.erro ?? null,
        urlDownload: job.status === "PRONTO" ? `/api/v1/pacotes-comprovacao/${id}/arquivo?${query}` : null,
        expiraEm: job.status === "PRONTO" ? new Date(expires).toISOString() : null };
    },
    async download(id: string, query: Record<string, unknown>) {
      const { tenant, expires, signature: supplied } = query;
      if (typeof tenant !== "string" || typeof expires !== "string" || !/^\d{13}$/.test(expires) ||
          typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied)) throw new HttpError(403, "Link inválido");
      const expiry = Number(expires);
      if (expiry <= Date.now() || expiry > Date.now() + LINK_MS) throw new HttpError(403, "Link expirado ou inválido");
      const job = await read(tenant, id);
      if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(signature(job, tenant, id, expiry), "hex"))) {
        throw new HttpError(403, "Link inválido");
      }
      if (job.status !== "PRONTO" || !job.entradas) throw new HttpError(409, "Pacote ainda não disponível");
      if (downloads >= 2) throw new HttpError(429, "Aguarde os downloads em andamento");
      downloads++;
      try {
        const files: Record<string, Uint8Array> = {};
        let total = 0;
        for (const entry of job.entradas) {
          const { bytes } = await proof(entry.path);
          total += bytes.length;
          if (total > MAX_BYTES) throw new HttpError(413, "Pacote excede 20 MiB");
          if (digest(bytes) !== entry.sha256) throw new HttpError(409, "Comprovante alterado; solicite outro pacote");
          files[entry.arquivo] = bytes;
        }
        const summary = { id, embarcadorId: job.embarcadorId, inicio: job.inicio ?? null, fim: job.fim ?? null,
          quantidadeEntregas: job.entradas.length,
          valorTotal: job.entradas.reduce((sum, entry) => sum + Math.round(entry.valorTotal * 100), 0) / 100,
          entregas: job.entradas.map(({ id, numeroNF, valorTotal, criadoEm }) => ({ id, numeroNF, valorTotal, criadoEm })) };
        const report = Buffer.from(JSON.stringify(summary, null, 2));
        files["resumo.json"] = report;
        files["manifesto.json"] = Buffer.from(JSON.stringify({ algoritmo: "SHA-256", arquivos: [
          { arquivo: "resumo.json", sha256: digest(report) },
          ...job.entradas.map(({ arquivo, sha256 }) => ({ arquivo, sha256 })),
        ] }, null, 2));
        return Buffer.from(zipSync(files, { level: 0 }));
      } finally { downloads--; }
    },
  };
}
