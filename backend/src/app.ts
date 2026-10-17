import express from "express";
import cors from "cors";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());

// Rota raiz para teste rápido no navegador / Compose
app.get("/", (_req, res) => {
  res.json({ message: "EntregaProva API está ativa!" });
});

// Rotas versionadas
app.use("/api/v1", routes);

export default app;
