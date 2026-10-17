import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";

const routes = Router();

routes.get("/health", getHealth);

export default routes;
