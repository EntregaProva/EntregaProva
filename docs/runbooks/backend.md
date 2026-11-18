# Backend: Render, Firebase e Supabase Storage

Arquitetura confirmada em 06/11/2026: API no Render; autenticação e banco no
Firebase Auth/Firestore; comprovantes no Supabase Storage; frontend no Firebase
Hosting. Supabase não substitui autenticação, claims nem banco nesta arquitetura.
As definições de Cloud Run, Artifact Registry e Cloud Storage foram removidas
da configuração de publicação por conflitarem com essa decisão.

## Configuração no Render — backend e DevOps

`render.yaml` é um modelo do serviço existente, não uma publicação executada.
Usa o Dockerfile do backend, Node 24, porta indicada por PORT e bind 0.0.0.0.
O health check do serviço é `/readyz`; `/healthz` é liveness sem dependências.
Desativar o auto-deploy por commit: a publicação é disparada pelo Actions depois
dos checks, com o SHA aprovado. Conferir que o serviço aponta ao repositório
oficial e à main. Não criar outro serviço por engano ao importar o Blueprint.

| Variável no Render | Configuração |
| --- | --- |
| NODE_ENV | production |
| FIREBASE_PROJECT_ID | ID real do Firebase; nunca demo-* |
| GOOGLE_APPLICATION_CREDENTIALS | /etc/secrets/firebase-admin.json |
| PROOF_STORAGE_PROVIDER | supabase |
| SUPABASE_URL | Origem HTTPS do projeto Supabase |
| SUPABASE_SECRET_KEY | Chave secreta do backend ou service_role legado |
| SUPABASE_STORAGE_BUCKET | Nome do bucket privado, por exemplo comprovantes |
| CORS_ALLOWED_ORIGINS | Origens exatas do frontend separadas por vírgula |
| CORS_HOSTING_SITE | ID do site Hosting, para canais pr-NUMERO |

Cadastrar `firebase-admin.json` como **Secret File** no Render. Usar uma conta
com as permissões necessárias ao Firestore e à verificação dos tokens Firebase;
não armazenar esse arquivo no Git nem na imagem. ADC lê o caminho acima. O
backend rejeita FIREBASE_SERVICE_ACCOUNT_JSON: a configuração aceita é o arquivo
montado. Não configurar hosts de emuladores em produção.

Criar usuários sintéticos no Auth e atribuir custom claims pelo Admin SDK:
tenantId e role (admin/operator/driver). O seed atual é exclusivo do emulador.
DriverId de uma entrega precisa ser o UID do motorista do mesmo tenant.

Publicar os índices versionados antes do teste de listagem em produção:

```sh
firebase deploy --only firestore:indexes --project ID_REAL_DO_FIREBASE
```

Aguardar os índices ficarem prontos. O emulador não comprova que o índice já
existe na nuvem. Preservar as Security Rules deny-all para clientes.

## Bucket Supabase — backend e responsável pela infraestrutura

Criar o bucket como **privado**, com limite de **300000 bytes** e estes tipos:
image/jpeg, image/png, image/webp e application/pdf (compatibilidade legada).
O servidor confere essas condições na inicialização e falha com mensagem
genérica se houver configuração insegura ou indisponível. Acesso direto de
anon/authenticated não é necessário; não criar políticas públicas de leitura.

A chave secreta fica somente no backend. A autorização acontece antes do
upload/assinatura: token Firebase verificado, tenant e motorista da entrega.
O backend salva apenas o caminho privado e emite links por até 15 minutos.
Upload usa upsert=false e caminhos determinísticos; somente o erro específico
de duplicata permite reutilizar o arquivo. Falha de credencial ou de bucket
continua sendo erro, sem ser confundida com uma foto expirada.

Retenção de 60 dias, preservando os metadados no Firestore:

```sh
cd backend
npm run build
npm run cleanup:proofs
```

O comando simula e exibe somente a contagem. Após conferir ambiente e prazo,
`npm run cleanup:proofs -- --apply` remove apenas os arquivos vencidos que
seguem o caminho de comprovantes da aplicação. A rotina usa a API de Storage,
nunca DELETE direto em storage.objects. Configurar sua execução diária no
agendador aprovado pela equipe; esse agendamento não foi aplicado na nuvem.
O container de produção contém dist e dependências: executar a rotina de uma
checkout operacional com scripts, ou de um runner que faça build primeiro.

Arquivo removido retorna arquivoDisponivel=false, arquivoUrl=null e expiraEm=null
no detalhe. Repetição de upload já concluído retorna 410 e não recria a foto.

## GitHub Actions — DevOps

Em Settings > Secrets and variables > Actions, configurar:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Variable | API_BASE_URL | Origem HTTPS da API no Render, sem /api/v1 |
| Variable | FIREBASE_PROJECT_ID | Projeto real usado pelo frontend |
| Variable | VITE_FIREBASE_API_KEY | Configuração pública Web do Firebase |
| Secret | RENDER_DEPLOY_HOOK_URL | Hook secreto do serviço existente |
| Secret | FIREBASE_SERVICE_ACCOUNT_ENTREGAPROVA | JSON autorizado a publicar Hosting |

Não usar a chave Supabase no frontend, em VITE_* ou nos artefatos de build.
Os avisos de contexto no editor dependem da existência/visibilidade dessas
configurações; nomes GCP de deploy não são mais necessários nos workflows.

Merge na main: CI -> hook Render com SHA explícito -> smoke aguarda a API
responder JSON, revision igual ao SHA e readiness 200 -> publicação Hosting.
Sucesso do hook sozinho não significa deploy concluído. RENDER_GIT_COMMIT é
exposto como revision pelo health. Se a API não confirmar a revisão, Hosting
não é publicado; isso não faz rollback automático de uma API já publicada.

PR interno: CI -> build frontend com URL absoluta do Render -> smoke da API
publicada -> canal Hosting pr-NUMERO por sete dias. O preview usa a API já
publicada e não implanta backend do PR. PR de fork não recebe credenciais.
firebase.json mantém somente fallback da SPA: API não é proxy do Hosting.
O CORS deve incluir produção e habilitar somente os previews do próprio site.

## Validação — backend e QA

```sh
cd backend
npm run lint
npm run build
npm run test:smoke
npm run test:emulator
```

Em 06/11/2026: 99 testes passaram com Auth/Firestore/Storage emulados; nenhum
teste de integração ou isolamento foi pulado. Existe um todo anterior sobre
extensão .xml: a API recebe conteúdo XML em JSON, não nome de arquivo.
Os quatro testes Node verificam smoke, gate de publicação Render, configuração
Web e retenção. O SDK Supabase é real nos testes do adaptador, mas seu transporte
HTTP é simulado; isso não certifica bucket, credenciais ou acesso real.

Docker: build da imagem de produção aprovado e runtime Node 24.22.2 verificado
em container isolado, sem rede: health=200 com SHA sintético e ready=503 com
dependências deliberadamente offline. Compose/YAML/JSON e diff foram validados.
A auditoria de dependências fica no job específico do CI; o Dockerfile evita
repetir consultas de audit durante instalação/prune da imagem.

A consulta pública de 06/11/2026 ao serviço já existente retornou healthz=200
e readyz=503. A revisão nova não foi publicada; conferir no Render as credenciais
ADC, ID do projeto e acesso ao Firestore. O health público ainda não informou SHA.
Não há evidência de upload ou assinatura real no Supabase nesta revisão.

`npm audit --omit=dev` encontrou 8 alertas moderados e nenhum alto/crítico em
produção. A auditoria completa ainda aponta 6 altos e 3 críticos na árvore de
desenvolvimento/testes (Firebase/Vitest e dependências). As correções sugeridas
envolvem versões principais; essa atualização precisa de uma tarefa específica
com validação das suítes. Os checks de audit existentes foram preservados.

```sh
npm run smoke -- https://SUA_API_RENDER SHA_PUBLICADO
npm run verify:published
```

O segundo comando exige TARGET_API_URL, TEST_OPERATOR_TOKEN, TEST_DRIVER_TOKEN,
TEST_OTHER_DRIVER_TOKEN, TEST_OTHER_TENANT_TOKEN e TEST_DELIVERY_ID, com usuários
sintéticos. Repetir no ambiente publicado importação, upload, retry, expiração
e aprovação/rejeição, guardando resultado e SHA sem tokens ou dados pessoais.
Registrar também bucket privado, limites, índice ativo e primeira chamada após
ociosidade. Não afirmar que a integração foi validada apenas por compilar.

## Pendências para fechar a demonstração — frontend e backend juntos

O frontend atual em entregaprova-app/src/api/deliveries.ts assume outro contrato.
Não foi alterado nesta revisão do backend. Ajustes necessários:

| Fluxo | Contrato do backend para o frontend consumir |
| --- | --- |
| Lista | GET /api/v1/entregas -> itens e proximoCursor; mapear numeroNF, chaveNFe, destinatario, criadoEm e status |
| Importação | POST /api/v1/entregas/xml; JSON xmlContent e driverId opcional |
| Comprovante | POST /api/v1/entregas/:id/comprovantes; foto, recebedor, dataHora e Idempotency-Key |
| Fila de conferência | GET /api/v1/entregas?status=COMPROVADO; detalhe GET /entregas/:id para foto e XML extraído |
| Conferência | POST /api/v1/entregas/:id/conferencia; decisao APROVAR/REJEITAR e motivo na rejeição |

Estados permanecem PENDENTE, COMPROVADO, CONFERIDO e REJEITADO. As rotas inglesas
anteriores continuam disponíveis; elas não equivalem às novas rotas presumidas
pelo frontend. Comprimir foto até 300 KB, tratar 410 e renovar link pelo detalhe.

## Monitoramento e rollback — DevOps e QA

Logs JSON incluem severity, requestId, route, status, durationMs e tenantId
verificado, sem XML, nomes, tokens ou URLs assinadas. Usar esses eventos para
acompanhar 5xx e p95. Configurar alertas no monitor aprovado pela equipe e
acompanhar quota de Storage no Supabase. As antigas políticas de Monitoring
GCP não são usadas. Alertas e quotas reais ainda precisam de evidência externa.

1. Identificar o último SHA aprovado e o par frontend/API compatível.
2. Conferir compatibilidade dos dados antes de voltar a versão.
3. No histórico de deploys do Render, republicar o SHA conhecido.
4. No histórico Hosting, restaurar a release correspondente.
5. Repetir smoke e fluxo sintético, verificando revision, logs e resultado.
6. Registrar responsável e horário; não apagar banco ou fotos no rollback.

Rollback não é ensaiado nem aplicado automaticamente nesta revisão. Não foram
incluídos CT-e, troca de autenticação/banco, novos estados ou telas.

Referências operacionais: [bucket privado Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[deploy hooks Render](https://render.com/docs/deploy-hooks) e
[Firebase Admin fora do Google](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments).
