import multer from "multer";
import { HttpError } from "../utils/httpError.js";

export const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 6, fieldSize: 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(415, "Tipo de comprovante não permitido"));
  },
});
