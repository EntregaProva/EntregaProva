import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const reportDirectory = process.env.BACKEND_TEST_REPORT_DIR
  || fileURLToPath(new URL("../docs/testes/resultados/", import.meta.url));

export default defineConfig({
  test: {
    outputFile: { junit: resolve(reportDirectory, "junit.xml") },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reportOnFailure: true,
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: resolve(reportDirectory, "coverage"),
    },
  },
});
