import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const reportDirectory = process.env.BACKEND_TEST_REPORT_DIR
  || fileURLToPath(new URL("../../docs/testes/resultados/", import.meta.url));
const report = resolve(reportDirectory, "coverage/coverage-summary.json");
const { total, ...files } = JSON.parse(readFileSync(report, "utf8"));
const domainPaths = /\/src\/(?:services\/|controllers\/delivery\.controller\.ts$|utils\/(?:xmlParser|nfeKeyValidator|proofFile)\.ts$)/;
const domain = Object.entries(files)
  .filter(([path]) => domainPaths.test(path.replaceAll("\\", "/")))
  .reduce((sum, [, coverage]) => ({
    covered: sum.covered + coverage.lines.covered,
    total: sum.total + coverage.lines.total,
  }), { covered: 0, total: 0 });

for (const [scope, lines, minimum] of [["Global", total.lines, 60], ["Domínio", domain, 80]]) {
  const percentage = lines.total ? (100 * lines.covered) / lines.total : 0;
  console.log(`${scope}: ${percentage.toFixed(2)}% de linhas (${lines.covered}/${lines.total}), mínimo ${minimum}%`);
  if (percentage < minimum) process.exitCode = 1;
}
