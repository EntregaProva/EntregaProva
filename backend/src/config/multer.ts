import multer from "multer";
import { HttpError } from "../utils/httpError.js";
import { MAX_PROOF_BYTES, PROOF_MIME_TYPES } from "./proof.js";

export const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 6, fieldSize: 1024 },
  fileFilter: (_req, file, cb) => {
    if (PROOF_MIME_TYPES.some(type => type === file.mimetype)) cb(null, true);
    else cb(new HttpError(415, "Tipo de comprovante não permitido"));
  },
});
