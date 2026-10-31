import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.middleware.js";
import { createDeliveryControllers } from "../controllers/delivery.controller.js";
import { uploadProof } from "../config/multer.js";
import { AppDependencies } from "../dependencies.js";

export function createRoutes(deps: AppDependencies) {
  const routes = Router();
  const c = createDeliveryControllers(deps);
  routes.use(authenticateToken(deps.auth));
  routes.post(["/deliveries/xml", "/entregas/xml"], requireRole(["admin", "operator"]), c.importXML);
  routes.get(["/deliveries/:id", "/entregas/:id"], c.authorizeDelivery, c.getDelivery);
  routes.post("/deliveries/:id/proof", requireRole(["driver", "admin"]), c.authorizeDelivery,
    uploadProof.single("file"), c.submitProof);
  routes.post("/entregas/:id/comprovantes", requireRole(["driver", "admin"]), c.authorizeDelivery,
    uploadProof.single("foto"), c.submitProof);
  routes.patch("/deliveries/:id/check", requireRole(["admin", "operator"]), c.authorizeDelivery, c.checkProof);
  routes.post("/entregas/:id/conferencia", requireRole(["admin", "operator"]), c.authorizeDelivery, c.checkProof);
  return routes;
}
