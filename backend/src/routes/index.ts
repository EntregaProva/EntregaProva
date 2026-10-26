import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import { authenticateToken, requireRole } from "../middlewares/auth.middleware";
import { importXML, submitProof, checkProof } from "../controllers/delivery.controller";
import { uploadProof } from "../config/multer";

const routes = Router();

// Rotas públicas de diagnóstico operacional
routes.get("/health", getHealth);
routes.get("/healthz", getHealth);
routes.get("/readyz", getHealth);

// Rotas protegidas (Jornadas 1 a 3)
routes.use(authenticateToken);

// Jornada 1: Operador ou Admin importa o XML
routes.post("/deliveries/xml", requireRole(["admin", "operator"]), importXML);

// Jornada 2: Motorista envia foto do canhoto e recebedor
routes.post("/deliveries/:id/proof", requireRole(["driver", "admin"]), uploadProof.single("file"), submitProof);

// Jornada 3: Operador confere o comprovante
routes.patch("/deliveries/:id/check", requireRole(["admin", "operator"]), checkProof);

export default routes;
