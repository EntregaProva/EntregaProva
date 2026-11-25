# Checkpoints 3 e 4: o que pedem e como o DevOps atende

Escopo: somente a parte de DevOps. Fonte: guias dos Checkpoints 3 e 4 e Plano Custo Zero.
Onde o guia cita Google Cloud (Cloud Run, Artifact Registry, Workload Identity, Secret Manager,
Cloud Monitoring), a equipe usa o equivalente do Plano Custo Zero (Render, Firebase Hosting,
UptimeRobot, GitHub Actions), sem cartão e sem conta de faturamento. As exceções estão no ADR
"Chave de conta de serviço no lugar de Workload Identity Federation".

Legenda: OK = feito e com evidência. EXC = exceção consciente do Custo Zero. FALTA = ainda a fazer.
CONFERIR = depende de confirmação no painel ou com outro papel.

## Checkpoint 3 (15/11)

| # | O guia pede | Como atendemos | Evidência | Status |
|---|---|---|---|---|
| 1 | Frontend no Hosting e API no Cloud Run, com rewrite `/api/**` | Frontend no Firebase Hosting, API no Render. O front chama a API por `VITE_API_URL`, sem rewrite; a API libera CORS. | `firebase.json`, `render.yaml`, `.github/workflows/` | EXC |
| 2 | Deploy automático: PR gera preview, merge atualiza produção | PR gera canal de preview no Hosting. Merge na main roda CI, publica a API no Render pelo deploy hook e depois publica o Hosting. | `firebase-hosting-pull-request.yml`, `firebase-hosting-merge.yml` | OK |
| 3 | Workload Identity, sem JSON nos secrets | Chave de conta de serviço em GitHub Secrets e no Render, com papel mínimo e gitleaks bloqueante. | ADR da chave de serviço | EXC (ADR precisa ser entregue ao Tech Lead) |
| 4 | Imagens por SHA e retenção das 5 últimas | Sem Artifact Registry. O Render guarda o histórico de deploys; o deploy é feito com o SHA aprovado (`EXPECTED_API_REVISION`). | `firebase-hosting-merge.yml`, lista de deploys do Render | EXC |
| 5 | Cloud Run com min 0, max 3 e concorrência 40 a 80 | Render Free: uma instância, dorme após 15 min. Equivale ao min 0. | `render.yaml`, `docs/finops.md` | EXC |
| 6 | Probes de startup e liveness nos health checks | Health Check Path do Render em `/readyz`. `/healthz` é liveness. | `render.yaml`, `backend/src/app.ts` | OK (conferir o painel do Render) |
| 7 | Dois alertas: erro 5xx e latência p95 | UptimeRobot avisa por e-mail quando a API cai. Latência p95 medida com k6 no Compose. Não há alerta de taxa de 5xx no plano gratuito. | `docs/uptimerobot-plano-gratuito.png`, `docs/latencia-p95.md`, `docs/k6-p95-healthz.png` | EXC (apontar `/readyz` no UptimeRobot) |
| 8 | Segredos no Secret Manager, no máximo 5 | Segredos só em GitHub Secrets e variáveis do Render. No Git, apenas `.env.example`. | `.env.example`, ADR | OK |
| 9 | Configuração como código | `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `render.yaml`, workflows. | arquivos na raiz | OK |
| 10 | Gasto acumulado até US$ 12 | US$ 0,00. Spark, Render Free e UptimeRobot Free, sem cartão. | `docs/finops.md` | OK |
| 11 | Runbook de rollback em `/docs` (Tech Lead, com apoio do DevOps) | Ver Checkpoint 4, item 3. | `docs/runbooks/rollback.md` | FALTA |

## Checkpoint 4 (29/11)

| # | O guia pede | Como atendemos | Evidência | Status |
|---|---|---|---|---|
| 1 | Pipeline bloqueante: lint, testes, cobertura, gitleaks, varredura de dependências | `ci.yml` roda lint, build, testes, npm audit e gitleaks. Os deploys dependem do CI (`needs`). A main exige PR aprovado e checks verdes. | `ci.yml`, `docs/branch-protection-main-codigo.png`, `docs/testes/` | OK. Falta o scan de imagem (Trivy) e conferir a cobertura mínima como check obrigatório |
| 2 | Rollback ensaiado, com tempo registrado no runbook | Rollback feito no Render e no Hosting; falta o runbook com data, hora e tempo. | `docs/render-rollback.png`, `docs/render-rollback-lista.png` | FALTA o runbook |
| 3 | Exportação manual do Firestore antes da demo | Depende de um script do Backend (o Spark não tem export gerenciado). | | FALTA |
| 4 | Auditoria de custo em `/docs/finops` | Seção de auditoria no `finops.md`, com total, maiores usos e ações. | `docs/finops.md` | FALTA a seção |
| 5 | Congelamento se o gasto chegar a US$ 40 | Não se aplica: o gasto é US$ 0 e não há cobrança possível sem cartão. Registrar isso na auditoria. | `docs/finops.md` | FALTA registrar |

## Antes do Demo Day (05/12)

- Acordar a API uns 5 minutos antes (abrir `/readyz`), por causa do cold start do Render Free.
- Combinar com o time o congelamento de merges depois de 29/11.
