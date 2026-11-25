# FinOps: situação de custos

Atualizado em 25/11/2026.

## Situação atual

- O desenvolvimento usa o id `demo-entregaprova` (ver `.firebaserc` no repositório de código). É um projeto de demonstração dos emuladores do Firebase: não existe na nuvem e não tem conta de faturamento vinculada.
- O desenvolvimento roda inteiro nos emuladores locais (Auth, Firestore e Storage) via Docker Compose, sem uso de recursos do Google Cloud.
- O projeto Firebase real da equipe está no plano gratuito **Spark**, sem conta de faturamento e sem cartão cadastrado (evidência na seção seguinte).
- A API está no ar no Render (plano Free), em `https://entregaprova.onrender.com`. O frontend é publicado no Firebase Hosting (plano Spark) por GitHub Actions: preview a cada PR e produção no merge da `main`.
- Os comprovantes ficam no Supabase Storage (plano Free).
- Monitoramento: o Render faz health check em `/healthz` e o UptimeRobot avisa por e-mail quando a API cai. Nenhum dos dois tem cartão cadastrado.
- **Gasto acumulado: US$ 0,00** (tetos do guia: US$ 5,00 no CP2 e US$ 12,00 no CP3).

## Evidência do plano Firebase Spark

O guia de avaliação pede o print do painel de faturamento. Como o projeto da equipe está no plano Spark, não existe painel de faturamento com gasto a mostrar. A prova de que não há cobrança possível é mostrar que o projeto está no plano gratuito e que nenhuma conta de faturamento está vinculada a ele. Os dois prints abaixo cumprem esse papel.

**Print A: plano do projeto.** Painel do projeto Firebase da equipe, com o plano **Spark (sem custo, US$ 0 por mês)** visível. O plano Spark não permite cobrança: quando um limite diário é atingido, o serviço para até o dia seguinte e nada é cobrado.

![Print A: projeto Firebase no plano Spark](firebase-spark-sem-faturamento-a.png)

**Print B: ausência de faturamento.** Configurações de uso e faturamento do projeto, mostrando o plano Spark e nenhuma conta de faturamento vinculada. Sem conta de faturamento e sem cartão cadastrado, o pior que pode acontecer é um serviço parar, nunca uma cobrança.

![Print B: configurações de uso e faturamento sem conta vinculada](firebase-spark-sem-faturamento-b.png)

Complementam essa evidência:

- O `.firebaserc` com o id `demo-entregaprova`, prefixo usado apenas por projetos de emulador, que não geram cobrança.
- Todo o ambiente de desenvolvimento rodando localmente nos emuladores, via Docker Compose.

![Print do .firebaserc com o id demo-entregaprova](print-firebaserc.png)

## Evidência do plano gratuito do Render, do UptimeRobot e do Supabase

**Render (API).** Plano **Hobby, US$ 0/mês**, marcado como plano atual. O serviço `EntregaProva` roda na instância **Free**. O custo adicional ("compute costs") só se aplica a instâncias pagas, que não usamos.

![Render: plano Hobby, US$ 0/mês](render-plano-gratuito.png)

**UptimeRobot (monitoramento).** Plano **Free, US$ 0/mês**, 50 monitores, checagem a cada 5 minutos, com a indicação "No credit card required".

![UptimeRobot: plano Free, sem cartão](uptimerobot-plano-gratuito.png)

**Supabase (Storage dos comprovantes).** Plano **Free**, sem forma de pagamento cadastrada.

![Supabase: plano Free, sem cartão](supabase-plano-gratuito.png)

**Firebase Hosting.** Não tem plano próprio: usa o do projeto Firebase, que está no Spark (Prints A e B acima).

## Deploy automático (Checkpoint 3)

O deploy não depende de comando manual. Existem dois caminhos, ambos por GitHub Actions.

**Pull request: preview.** Cada PR roda o CI e, se ele passar, publica um canal de preview no Firebase Hosting. O link aparece como comentário no próprio PR, e o revisor testa a mudança ali antes de aprovar.

![Preview do PR publicado no Hosting, com o link no comentário](preview-pr-hosting.png)

**Merge na main: produção.** O merge roda o CI de novo. Se passar, o workflow "Render e Hosting" publica o commit aprovado na API (Render, por deploy hook) e, em seguida, o frontend (Hosting). Se qualquer etapa falhar, o deploy para.

![Execução do workflow Render e Hosting na main](actions-deploy-main.png)

## Health checks e monitoramento (Checkpoint 3)

- `/healthz` responde sem depender de nada (liveness). É o caminho usado pelo Render (Settings → Health Checks) e pelo monitor do UptimeRobot.
- `/readyz` confere se o Firestore responde (readiness). Na primeira chamada depois que a API acorda, ele pode falhar uma vez por causa do timeout, por isso não é usado para alerta.

![Resposta do /healthz](healthz-ok.png)

![Resposta do /readyz](readyz-ok.png)

## Rollback (Checkpoint 3)

**API (Render).** O histórico de deploys do serviço permite voltar a uma versão anterior pelo botão **Rollback**. Rollback feito em 01/11/2026, às 11:25:34 (GMT-3), concluído em 20,9 segundos, com a versão anterior de volta ao ar.

![Render: lista de deploys com a opção Rollback](render-rollback-lista.png)

![Render: rollback concluído via Dashboard](render-rollback.png)

**Frontend (Firebase Hosting).** O Hosting guarda o histórico de versões publicadas (Previous releases), e cada versão anterior pode ser restaurada pelo console. O ensaio completo de rollback do frontend é registrado no runbook do Checkpoint 4.

![Firebase Hosting: versão atual e histórico de versões anteriores](hosting-rollback.png)

## Proteção da branch main (repositório de código)

A `main` está protegida: nenhuma alteração entra sem pull request aprovado por outra pessoa e com os checks do CI verdes (lint e build do backend e do frontend, `docker compose build`, gitleaks e `npm audit` do backend e do frontend), com a branch atualizada e sem permissão de force push.

![Regra de proteção da main](branch-protection-main-codigo.png)

## Estimativa na calculadora de preços do Google Cloud (cenário original com GCP)

Feita em 25/10/2026, na calculadora oficial do Google Cloud, sem conta de faturamento. Região: São Paulo (southamerica-east1). Os valores de uso são estimativas para uma demo pequena, com cerca de 20 usuários.

| Serviço | Uso estimado | Custo mensal |
|---|---|---|
| Cloud Run | 50.000 requisições por mês, tráfego com pico diário, cobrança só durante requisições, instâncias mínimas = 0 | US$ 0,71 |
| Firestore | 5.000 leituras, 500 escritas e 50 exclusões por dia, 1 GiB armazenado | US$ 0,00 |
| Cloud Storage | 5 GiB armazenados, 10.000 operações de escrita e 50.000 de leitura por mês, 5 GiB de saída de dados | US$ 0,18 |
| **Total** | | **US$ 0,88** |

Essa estimativa foi feita para o cenário com Cloud Run e Cloud Storage. Com o Plano Custo Zero, esses serviços não são usados (a API vai para o Render e os arquivos para o Supabase Storage, ambos em plano gratuito), então o custo previsto é US$ 0,00. A estimativa fica registrada como referência do cenário original.

![Estimativa na calculadora de preços do Google Cloud](estimativa-calculadora.png)

## Alertas de orçamento (50/80/100%): substituídos no Plano Custo Zero

Os alertas de orçamento exigem um projeto com conta de faturamento (plano Blaze), e o Blaze exige o cadastro de um cartão de crédito. Como a equipe não terá voucher do GCP, ela adota o Plano Custo Zero: nenhum projeto liga conta de faturamento e nenhum cartão é cadastrado em nenhum serviço.

Por isso, **os alertas de orçamento não foram criados, e essa é uma decisão consciente, não um esquecimento**. Sem faturamento não há cobrança possível, e os alertas deixam de ser necessários. No lugar deles, a evidência para o tutor é a prova de que não existe faturamento ligado ao projeto, apresentada nos Prints A e B acima.

A decisão formal e a aprovação do professor para as exceções ao Caderno (Render no lugar do Cloud Run, Supabase no lugar do Cloud Storage, entre outras) são registradas em ADR pelo Tech Lead.

## Controles previstos para a fase de nuvem

- Regra de ouro: nunca cadastrar cartão em nenhum serviço e nunca clicar em Upgrade ou Blaze no Firebase.
- Testes pesados e carga apenas nos emuladores locais, para não gastar a cota diária do Firestore.
- Listas paginadas e queries controladas.
- Sem listeners grandes sem justificativa.
- Revisão de leituras e escritas do Firestore.
- Conferência dos limites gratuitos dos serviços antes do primeiro deploy.

## Conferência dos limites gratuitos (31/10/2026)

Antes do primeiro deploy, os limites gratuitos usados pelo Plano Custo Zero foram conferidos de novo nas páginas oficiais dos serviços. Nenhum limite mudou em relação à conferência de 14/10/2026. O Supabase foi conferido em 25/11/2026.

| Serviço | Limite gratuito conferido |
|---|---|
| Firebase Hosting (Spark) | 10 GB armazenados e 360 MB de transferência por dia |
| Firestore (Spark) | 1 GiB armazenado; 50 mil leituras, 20 mil escritas e 20 mil exclusões por dia |
| Render (web service Free) | 750 horas por mês por workspace; dorme após 15 min sem tráfego e leva cerca de 1 min para acordar; sem disco persistente |
| UptimeRobot (Free) | 50 monitores, checagem a cada 5 min, alerta por e-mail |
| Supabase Storage (Free) | 1 GB de arquivos e 5 GB de saída por mês; arquivo de até 50 MB (o bucket do projeto limita a 300 KB por arquivo); projeto é pausado após 7 dias de pouca atividade e pode ser retomado no painel |

O Firebase Spark declara não exigir método de pagamento. No Render, o plano Hobby (US$ 0/mês) é o plano atual, conforme o print acima. No UptimeRobot, o plano Free indica "No credit card required", também conforme o print acima. No Supabase, o plano Free está ativo e não há forma de pagamento cadastrada, conforme o print acima.

## Evidências

- Plano Spark do projeto Firebase: `firebase-spark-sem-faturamento-a.png` nesta pasta.
- Ausência de conta de faturamento: `firebase-spark-sem-faturamento-b.png` nesta pasta.
- Plano gratuito do Render (Hobby): `render-plano-gratuito.png` nesta pasta.
- Plano gratuito do UptimeRobot (Free): `uptimerobot-plano-gratuito.png` nesta pasta.
- Plano gratuito do Supabase (Free): `supabase-plano-gratuito.png` nesta pasta.
- Preview de PR no Hosting: `preview-pr-hosting.png` nesta pasta.
- Deploy automático na main: `actions-deploy-main.png` nesta pasta.
- Health checks: `healthz-ok.png` e `readyz-ok.png` nesta pasta.
- Rollback da API: `render-rollback-lista.png` e `render-rollback.png` nesta pasta.
- Rollback do Hosting: `hosting-rollback.png` nesta pasta.
- Proteção da branch `main`: `branch-protection-main-codigo.png` nesta pasta.
- `.firebaserc` com o id `demo-entregaprova`: `print-firebaserc.png` nesta pasta.
- Estimativa da calculadora de preços (cenário original): `estimativa-calculadora.png` nesta pasta.