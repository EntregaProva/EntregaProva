import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function stableRevision(service, expected) {
  const active = (service.status?.traffic ?? []).filter(target => target.percent > 0);
  const revision = active[0]?.revisionName;
  // Hosting pinTag selects latestReady, which may be an unpromoted candidate.
  if (active.length !== 1 || active[0].percent !== 100 || !revision || service.status.latestReadyRevisionName !== revision) {
    throw new Error("Hosting não pode fixar uma candidata ainda não promovida ou tráfego dividido");
  }
  if (expected && revision !== expected) throw new Error("API mudou durante a publicação do Hosting; repita a verificação");
  return revision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(stableRevision(JSON.parse(readFileSync(process.argv[2], "utf8")), process.argv[3]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
