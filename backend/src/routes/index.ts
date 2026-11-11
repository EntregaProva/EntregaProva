import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.middleware.js";
import { createDeliveryControllers } from "../controllers/delivery.controller.js";
import { uploadProof } from "../config/multer.js";
import { AppDependencies } from "../dependencies.js";
import { createProofPackageControllers } from "../controllers/proof-package.controller.js";
import { createUserController } from "../controllers/user.controller.js";

export function createRoutes(deps: AppDependencies) {
  const routes = Router();
  const c = createDeliveryControllers(deps);
  const packages = createProofPackageControllers(deps);
  // The download capability is short-lived and verified by the package service.
  routes.get("/pacotes-comprovacao/:id/arquivo", packages.download);
  routes.use(authenticateToken(deps.auth));
  const authorizePackages = requireRole(["admin", "operator", "financeiro"]);
  routes.post("/pacotes-comprovacao", authorizePackages, packages.create);
  routes.get("/pacotes-comprovacao/:id", authorizePackages, packages.get);
  routes.get(["/entregas", "/deliveries"], requireRole(["admin", "operator", "driver"]), c.listDeliveries);
  routes.post(["/deliveries/xml", "/entregas/xml"], requireRole(["admin", "operator"]), c.importXML);
  routes.get(["/deliveries/:id", "/entregas/:id"], requireRole(["admin", "operator", "driver"]), c.authorizeDelivery, c.getDelivery);
  routes.post("/deliveries/:id/proof", requireRole(["driver", "admin"]), c.authorizeDelivery,
    uploadProof.single("file"), c.submitProof);
  routes.post("/entregas/:id/comprovantes", requireRole(["driver", "admin"]), c.authorizeDelivery,
    uploadProof.single("foto"), c.submitProof);
  routes.patch("/deliveries/:id/check", requireRole(["admin", "operator"]), c.authorizeDelivery, c.checkProof);
  routes.post("/entregas/:id/conferencia", requireRole(["admin", "operator"]), c.authorizeDelivery, c.checkProof);
  return routes;
}
