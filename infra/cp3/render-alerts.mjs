import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
for (const key of ["CLOUD_RUN_SERVICE", "STORAGE_BUCKET", "NOTIFICATION_CHANNEL"]) if (!process.env[key]) throw new Error(`Configure ${key}`);
mkdirSync(".firebase/alerts", { recursive: true });
for (const file of ["5xx", "p95", "storage"]) {
  const template = readFileSync(`infra/cp3/alerts/${file}.json`, "utf8");
  const render = value => typeof value === "string" ? value.replace(/\$\{([A-Z_]+)\}/g, (_, key) => process.env[key])
    : Array.isArray(value) ? value.map(render)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, render(item)])) : value;
  writeFileSync(`.firebase/alerts/${file}.json`, JSON.stringify(render(JSON.parse(template)), null, 2));
}
