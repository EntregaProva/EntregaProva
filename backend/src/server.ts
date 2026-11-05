import "dotenv/config";
import { createApp } from "./app.js";
import { auth, db, storage } from "./config/firebase.js";

const logger = {
  info: (fields: Record<string, unknown>) => console.log(JSON.stringify({ severity: "INFO", timestamp: new Date().toISOString(), ...fields })),
  error: (fields: Record<string, unknown>) => console.error(JSON.stringify({ severity: "ERROR", timestamp: new Date().toISOString(), ...fields })),
};
const port = Number(process.env.PORT || 3000);
createApp({ auth, db, storage, logger }).listen(port, "0.0.0.0", () => {
  logger.info({ event: "server_started", port });
});
