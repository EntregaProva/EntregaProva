import { createHash, randomUUID } from "node:crypto";
import { Request, RequestHandler } from "express";
import { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import { AppDependencies } from "../dependencies.js";
import { parseNFeXML } from "../utils/xmlParser.js";
import { HttpError } from "../utils/httpError.js";

const LEASE_MS = 60_000;
export const SIGNED_URL_MS = 15 * 60 * 1000;
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function createDeliveryControllers(deps: AppDependencies) {
  const wrap = (handler: RequestHandler): RequestHandler =>
    (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
  const refFor = (req: Request) => {
    if (!/^\d{44}$/.test(req.params.id)) throw new HttpError(400, "Identificador de entrega inválido");
    return deps.db.doc(`tenants/${req.user!.tenantId}/deliveries/${req.params.id}`);
  };
  const authorizedData = (req: Request, snap: DocumentSnapshot): DocumentData => {
    if (!snap.exists) throw new HttpError(404, "Entrega não encontrada");
    const data = snap.data()!;
    if (req.user!.role === "driver" && data.driverId !== req.user!.uid) {
      throw new HttpError(403, "Entrega não atribuída ao motorista");
    }
    return data;
  };
  const signed = async (path: string) => {
    const expires = Date.now() + SIGNED_URL_MS;
    const [arquivoUrl] = await deps.storage.bucket().file(path).getSignedUrl({
      version: "v4", action: "read", expires,
    });
    return { arquivoUrl, expiraEm: new Date(expires).toISOString() };
  };

  const authorizeDelivery = wrap(async (req, _res, next) => {
    authorizedData(req, await refFor(req).get());
    next();
  });

  const importXML = wrap(async (req, res) => {
    const parsed = parseNFeXML(req.body?.xmlContent);
    const driverId = req.body?.driverId;
    if (driverId !== undefined && (!text(driverId, 128) || driverId.includes("/"))) {
      throw new HttpError(400, "Motorista inválido");
    }
    const data = {
      tenantId: req.user!.tenantId, chaveNFe: parsed.chave, numeroNF: parsed.numero,
      valorTotal: parsed.valorTotal, destinatario: parsed.destinatario,
      status: "PENDENTE", criadoEm: new Date().toISOString(), criadoPor: req.user!.uid,
      driverId: driverId ?? null,
    };
    const ref = deps.db.doc(`tenants/${req.user!.tenantId}/deliveries/${parsed.chave}`);
    await deps.db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) throw new HttpError(409, "NF-e já importada");
      tx.create(ref, data);
    });
    res.status(201).json({ id: parsed.chave, ...data });
  });

  const getDelivery = wrap(async (req, res) => {
    const data = authorizedData(req, await refFor(req).get());
    const result = { ...data };
    // Internal paths and upload reservations are never returned.
    delete result.uploadLease;
    if (data.comprovante) {
      const { arquivoPath, ...proof } = data.comprovante;
      result.comprovante = { ...proof, ...await signed(arquivoPath) };
    }
    res.json({ id: req.params.id, ...result });
  });

  const submitProof = wrap(async (req, res) => {
    const key = req.get("Idempotency-Key");
    if (!key || !/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
      throw new HttpError(400, "Idempotency-Key obrigatória (1 a 128 caracteres alfanuméricos, _ ou -)");
    }
    // Portuguese contract names and legacy English-route fields are supported.
    const recebedorNome = req.body.recebedor ?? req.body.recebedorNome;
    const dataHoraEntrega = req.body.dataHora ?? req.body.dataHoraEntrega;
    const file = req.file;
    if (!file || !text(recebedorNome) || !text(dataHoraEntrega, 40) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(dataHoraEntrega) ||
        !Number.isFinite(Date.parse(dataHoraEntrega))) {
      throw new HttpError(400, "Foto, nome do recebedor e data/hora ISO com fuso são obrigatórios");
    }
    const validMagic = file.mimetype === "image/jpeg" ? file.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
      file.mimetype === "image/png" ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
      file.buffer.subarray(0, 5).toString() === "%PDF-";
    if (!validMagic) throw new HttpError(415, "Conteúdo do arquivo incompatível com o tipo informado");
    const ref = refFor(req);
    const idemRef = deps.db.doc(`tenants/${req.user!.tenantId}/idempotency/${key}`);
    const fingerprint = createHash("sha256").update(JSON.stringify([
      req.params.id, req.user!.uid, recebedorNome, dataHoraEntrega, file.mimetype,
    ])).update(file.buffer).digest("hex");
    const owner = randomUUID();
    const path = `tenants/${req.user!.tenantId}/deliveries/${req.params.id}/proofs/${fingerprint}`;
    const reserved = await deps.db.runTransaction(async tx => {
      const delivery = authorizedData(req, await tx.get(ref));
      const previous = (await tx.get(idemRef)).data();
      if (previous && previous.fingerprint !== fingerprint) {
        throw new HttpError(409, "Idempotency-Key já usada para outra operação");
      }
      if (previous?.state === "completed") return { completed: true, proof: previous.proof };
      if (previous?.leaseUntil > Date.now() || delivery.uploadLease?.leaseUntil > Date.now()) {
        throw new HttpError(409, "Upload em andamento; repita a mesma chave após a conclusão");
      }
      if (!["PENDENTE", "REJEITADO"].includes(delivery.status)) {
        throw new HttpError(409, "Estado da entrega não permite novo comprovante");
      }
      const leaseUntil = Date.now() + LEASE_MS;
      tx.set(idemRef, { state: "pending", fingerprint, owner, leaseUntil });
      tx.update(ref, { uploadLease: { owner, leaseUntil } });
      return { completed: false, proof: null };
    });
    let proof = reserved.proof;
    if (!reserved.completed) {
      const blob = deps.storage.bucket().file(path);
      try {
        // Outside the Firestore callback: transaction retries must not repeat uploads.
        await blob.save(file.buffer, {
          resumable: false, metadata: { contentType: file.mimetype },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (error) {
        // A previous attempt may have uploaded successfully before losing its response.
        if ((error as { code?: number }).code !== 412) throw error;
      }
      proof = {
        recebedorNome: recebedorNome.trim(), dataHoraEntrega, arquivoPath: path,
        enviadoEm: new Date().toISOString(), motoristaId: req.user!.uid,
      };
      await deps.db.runTransaction(async tx => {
        const delivery = authorizedData(req, await tx.get(ref));
        const operation = (await tx.get(idemRef)).data();
        if (operation?.owner !== owner || delivery.uploadLease?.owner !== owner ||
            !["PENDENTE", "REJEITADO"].includes(delivery.status)) {
          throw new HttpError(409, "Reserva de upload alterada; repita a mesma chave");
        }
        tx.update(ref, { status: "COMPROVADO", comprovante: proof, conferencia: null, uploadLease: null });
        tx.set(idemRef, { state: "completed", fingerprint, proof, completedAt: new Date().toISOString() });
      });
    }
    const { arquivoPath, ...publicProof } = proof;
    res.json({
      message: "Comprovante registrado com sucesso", id: req.params.id, status: "COMPROVADO",
      comprovante: { ...publicProof, ...await signed(arquivoPath) },
    });
  });

  const checkProof = wrap(async (req, res) => {
    const aprovado = req.body.decisao !== undefined
      ? req.body.decisao === "APROVAR" ? true : req.body.decisao === "REJEITAR" ? false : undefined
      : req.body.aprovado;
    const motivo = req.body.motivo ?? req.body.motivoRejeicao;
    if (typeof aprovado !== "boolean" || (!aprovado && !text(motivo, 500))) {
      throw new HttpError(400, "Decisão inválida ou motivo da rejeição ausente");
    }
    const ref = refFor(req);
    const update = {
      status: aprovado ? "CONFERIDO" : "REJEITADO",
      conferencia: {
        aprovado, motivoRejeicao: aprovado ? null : motivo.trim(),
        conferidoPor: req.user!.uid, conferidoEm: new Date().toISOString(),
      },
    };
    await deps.db.runTransaction(async tx => {
      const data = authorizedData(req, await tx.get(ref));
      if (data.status !== "COMPROVADO") throw new HttpError(409, "Entrega não está comprovada");
      tx.update(ref, update);
    });
    res.json({ id: req.params.id, ...update });
  });

  return { authorizeDelivery, importXML, getDelivery, submitProof, checkProof };
}
