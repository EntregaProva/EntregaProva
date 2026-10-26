import { Request, Response } from "express";
import { db, storage } from "../config/firebase";
import { parseNFeXML } from "../utils/xmlParser";
import { validateNFeKey } from "../utils/nfeKeyValidator";

// Jornada 1: Importar XML e criar a entrega
export const importXML = async (req: Request, res: Response) => {
  try {
    const { xmlContent } = req.body;
    const tenantId = req.user!.tenantId;

    if (!xmlContent) {
      return res.status(400).json({ error: "Conteúdo XML não fornecido" });
    }

    const parsedData = parseNFeXML(xmlContent);
    const keyValidation = validateNFeKey(parsedData.chave);

    if (!keyValidation.isValid) {
      return res.status(422).json({ error: keyValidation.reason });
    }

    const deliveryDoc = {
      tenantId,
      chaveNFe: parsedData.chave,
      numeroNF: parsedData.numero,
      valorTotal: parsedData.valorTotal,
      destinatario: parsedData.destinatario,
      status: "PENDENTE",
      criadoEm: new Date().toISOString(),
      criadoPor: req.user!.uid
    };

    const docRef = await db.collection("deliveries").add(deliveryDoc);

    return res.status(201).json({ id: docRef.id, ...deliveryDoc });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

// Jornada 2: Motorista envia o comprovante (foto + metadados)
export const submitProof = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { recebedorNome, recebedorDocumento, dataHoraEntrega } = req.body;
    const tenantId = req.user!.tenantId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Arquivo do comprovante é obrigatório" });
    }
    if (!recebedorNome || !dataHoraEntrega) {
      return res.status(400).json({ error: "Nome do recebedor e data/hora são obrigatórios" });
    }

    const docRef = db.collection("deliveries").doc(id);
    const docSnap = await docRef.get();

    // Verificação estrita de isolamento de tenant
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Entrega não encontrada" });
    }
    if (docSnap.data()?.tenantId !== tenantId) {
      return res.status(403).json({ error: "Acesso negado: registro pertence a outro tenant" });
    }

    // Upload da imagem no Emulador de Storage
    const bucket = storage.bucket();
    const filePath = `tenants/${tenantId}/deliveries/${id}/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(filePath);

    await blob.save(file.buffer, {
      metadata: { contentType: file.mimetype }
    });

    const updatePayload = {
      status: "COMPROVADO",
      comprovante: {
        recebedorNome,
        recebedorDocumento: recebedorDocumento || null,
        dataHoraEntrega,
        arquivoUrl: filePath,
        enviadoEm: new Date().toISOString(),
        motoristaId: req.user!.uid
      }
    };

    await docRef.update(updatePayload);

    return res.status(200).json({ message: "Comprovante registrado com sucesso", ...updatePayload });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Jornada 3: Conferir comprovante contra os dados da NF-e
export const checkProof = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { aprovado, motivoRejeicao } = req.body;
    const tenantId = req.user!.tenantId;

    const docRef = db.collection("deliveries").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Entrega não encontrada" });
    }
    if (docSnap.data()?.tenantId !== tenantId) {
      return res.status(403).json({ error: "Acesso negado: registro pertence a outro tenant" });
    }

    const novoStatus = aprovado ? "CONFERIDO" : "REJEITADO";
    const updatePayload = {
      status: novoStatus,
      conferencia: {
        aprovado,
        motivoRejeicao: aprovado ? null : motivoRejeicao,
        conferidoPor: req.user!.uid,
        conferidoEm: new Date().toISOString()
      }
    };

    await docRef.update(updatePayload);

    return res.status(200).json({ id, ...updatePayload });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};