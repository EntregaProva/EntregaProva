import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[EntregaProva API] Servidor rodando na porta ${PORT}`);
});
