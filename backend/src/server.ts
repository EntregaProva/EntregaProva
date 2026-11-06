import "dotenv/config";
import { createApp } from "./app.js";
import { auth, db } from "./config/firebase.js";
import { createRuntimeProofStorage } from "./config/proof-storage.js";

const logger = {
  info: (fields: Record<string, unknown>) => console.log(JSON.stringify({ severity: "INFO", timestamp: new Date().toISOString(), ...fields })),
  error: (fields: Record<string, unknown>) => console.error(JSON.stringify({ severity: "ERROR", timestamp: new Date().toISOString(), ...fields })),
};
const port = Number(process.env.PORT || 3000);
createRuntimeProofStorage().then(proofStorage => {
  createApp({ auth, db, proofStorage, logger }).listen(port, "0.0.0.0", () => {
    logger.info({ event: "server_started", port });
  });
}).catch(() => {
  logger.error({ event: "startup_failed", message: "Verifique a configuração Firebase e o bucket privado de comprovantes" });
  process.exitCode = 1;
});
