# CP3 - operação e rollback do backend

## Contrato preservado

Papéis atuais: admin, operator, driver. Estados atuais: PENDENTE, COMPROVADO,
CONFERIDO, REJEITADO. Não houve migração de dados ou renomeação de papéis.
O alinhamento editorial com o OpenAPI depende do Tech Lead; não devem ser
adotados novos nomes só no frontend ou só no seed.

## O que a implementação cobre

- `/healthz` independe dos serviços e identifica o SHA em `revision`.
- `/readyz` faz leitura leve do Firestore, com timeout de 2 s.
- Logs JSON: severity, requestId, route, status, durationMs e tenantId verificado.
- Listagem por tenant/motorista com cursor; sem URLs assinadas na lista textual.
- Comprovante até 300.000 bytes. JPEG/PNG/WebP e PDF legado; aprovação final dos
  formatos com o Tech Lead. A assinatura inicial não equivale a decodificação completa.
- Detalhe de foto removida: arquivoDisponivel=false, arquivoUrl/expiraEm=null.
  Replay de uma operação concluída cujo objeto foi removido: 410, sem novo upload.
  A conferência histórica não muda automaticamente com a remoção do arquivo.
- Inicialização do Admin SDK pela identidade de execução/ADC, sem aceitar
  FIREBASE_SERVICE_ACCOUNT_JSON. Não configure hosts de emulador na produção.

## Preparação externa (não executada pela alteração de código)

DevOps/Tech Lead devem confirmar projeto Blaze, região única (referência:
us-central1), nome real do bucket privado, repositório de imagens e identidades.
As variáveis do GitHub são GCP_PROJECT_ID, GCP_REGION, CLOUD_RUN_SERVICE,
STORAGE_BUCKET, ARTIFACT_REPOSITORY, GCP_RUNTIME_SERVICE_ACCOUNT,
GCP_WIF_PROVIDER, GCP_DEPLOY_SERVICE_ACCOUNT, CORS_ALLOWED_ORIGINS e
VITE_FIREBASE_API_KEY. A chave Web do Firebase é configuração pública, não
credencial administrativa. Não adicione chave privada JSON como secret.
O pipeline habilita CORS_HOSTING_SITE para o site padrão do projeto, permitindo
somente seus canais pr-NÚMERO. Não há liberação genérica de *.web.app. Para um
site Hosting com ID diferente do projeto, ajustar essa configuração explícita.

WIF deve restringir o provedor ao repositório oficial e aos eventos/referências
autorizados. A conta de deploy publica no Artifact Registry/Cloud Run/Hosting,
aplica índices e pode usar a identidade de runtime; não precisa ser a mesma
conta que atende requisições. Restringir permissões às operações necessárias.
A conta de runtime precisa de acesso ao Firestore, aos objetos do bucket e de
assinatura remota (iam.serviceAccounts.signBlob, via política apropriada).
Validar IAM Credentials API e teste real de assinatura. O pipeline usar WIF não
comprova a assinatura pela conta do runtime.

Antes do primeiro deploy, assegurar que Cloud Run, Artifact Registry, Firebase
Hosting, Firestore e bucket existem, suas APIs estão habilitadas e a localização
é compatível. Os workflows não criam um projeto nem vinculam faturamento.

## Publicação

PR interno passa pelos checks e publica canal Hosting temporário com WIF. O
preview aponta à API publicada; não é um deploy do backend do PR. PR de fork
não recebe credenciais. Seu preview não deve acessar dados pessoais reais.
Antes e depois de publicar o preview, verifica-se que latestReady é a revisão
que recebe 100% do tráfego. Um deploy candidato não promovido deve ser resolvido
antes do preview, pois pinTag seleciona latestReady. A validação impede anunciar
um preview como revisado quando a API mudou durante a publicação.

Merge na main: checks -> build Docker no Actions -> imagem com SHA -> índices
-> revisão Cloud Run sem tráfego principal -> smoke com URL de candidate e SHA
-> promoção da revisão verificada -> Hosting. Nenhum comando de deploy precisa
ser executado no computador para essa trilha. Os workflows param na primeira
falha. O CI existente de audit/gitleaks permanece; eventuais débitos anteriores
nesses jobs precisam ser tratados sem desativar os checks.

Backend usa Node 24 no CI e nos containers: as dependências atuais de testes
Firebase exigem Node >=24.12. Parâmetros versionados: porta 8080, min-instances=0, max-instances=3,
concurrency=60, memória 512Mi e probes HTTP startup/liveness em /healthz.
As configurações versionadas ainda precisam de execução real para serem prova.

## Fotos, retenção e alertas

`infra/cp3/storage-lifecycle.json` define 60 dias no prefixo tenants/, conforme
ADR 005 consultado. Confirmar o prazo aprovado e habilitar acesso uniforme e
prevenção de acesso público no bucket. Security Rules deny-all são preservadas.
`infra/cp3/artifact-cleanup.json` conserva cinco versões do pacote
entregaprova-api e remove as demais desse pacote. São containers, não fotos.

Os arquivos em `infra/cp3/alerts` são políticas a revisar e aplicar no Monitoring:
5xx/total >5% por 60s, p95 >2000ms por 5min, bucket >1GB por 1h. Esses limiares
são propostas operacionais, não valores impostos pelo guia. Validar janela,
unidades, disponibilidade das métricas, canal e destinatário antes de ativar.
Para renderizar com o serviço, bucket e NOTIFICATION_CHANNEL configurados:

```sh
node infra/cp3/render-alerts.mjs
```

A saída fica em `.firebase/alerts`, ignorada pelo Git. A aplicação das políticas,
permissões e lifecycle é responsabilidade do administrador do projeto. Custo
real, alertas ativos e retenção aplicada só podem ser atestados no projeto.
Meta CP3: gasto acumulado <= US$12; alertas não interrompem cobrança.

## Testes e evidências

```sh
cd backend
npm run lint
npm run build
npm test
npm run test:smoke
npm run test:emulator
```

`npm test` local sem emuladores pula as suítes dependentes deles. O CI exige
Auth/Firestore/Storage; `test:emulator` inicia os três com versão fixada da CLI.
Integração usa Admin SDK real, login e ID token emulados, banco, transações e
bytes reais no Storage. Só o assinador é substituído nesse teste. Essa prova
não certifica IAM nem assinatura na nuvem. Os testes de Rules não apagam o
banco inteiro para evitar interferência nas suítes paralelas.

```sh
npm run smoke -- https://URL-CANDIDATA SHA-DO-COMMIT
npm run verify:published
```

O segundo comando requer CP3_TARGET_URL, CP3_OPERATOR_TOKEN, CP3_DRIVER_TOKEN,
CP3_OTHER_DRIVER_TOKEN, CP3_OTHER_TENANT_TOKEN e CP3_DELIVERY_ID. Os tokens são
ID tokens recentes de usuários sintéticos. A entrega deve pertencer ao motorista
principal, não aos outros usuários. O script não cria ou altera entregas; a
tentativa de conferência é feita com papel proibido. Nunca imprimir os tokens.
Para provar importação/upload/retry/conferência publicados, rodar também o
roteiro funcional com dados sintéticos e registrar commit, ambiente e resultado.

Após ociosidade, medir a primeira chamada; não usar aquecimento periódico para
ocultar cold start. A interface deve tolerar até 10 s com carregamento. Health
200 com HTML é falha, não sucesso. O smoke valida Content-Type e corpo.

## Rollback documentado (ensaio ao vivo fica para S8)

1. Identificar SHA/imagem/revisão anterior que passou no smoke. Verificar se a
   imagem ainda está entre as cinco versões retidas.
2. Conferir compatibilidade dos dados e do contrato. Esta alteração não migra
   estados nem requer reescrita de documentos existentes.
3. Direcionar o serviço à revisão conhecida usando os valores do ambiente:

```sh
gcloud run services update-traffic "$CLOUD_RUN_SERVICE" \
  --project "$GCP_PROJECT_ID" --region "$GCP_REGION" \
  --to-revisions "$PREVIOUS_REVISION=100"
```

4. No Hosting, restaurar a release correspondente pelo histórico de versões.
   Como os rewrites usam pinTag, mudar apenas o tráfego do serviço não troca a
   revisão fixada pelo Hosting. Restaurar o par frontend/API compatível.
5. Rodar smoke no endereço efetivo e repetir consulta/conferência sintética.
   Conferir logs/alertas. Registrar autor, horário, SHA e resultado sem tokens.
6. Não apagar dados ou comprovantes como parte do rollback. Se a imagem antiga
   não existir, reconstruir o SHA pelo pipeline antes de escolher a revisão.

## Dependências ainda fora do backend

O módulo atual `entregaprova-app/src/api/deliveries.ts` usa um contrato proposto
incompatível com as rotas/respostas já existentes. O backend preserva as rotas
atuais; quem mantém o frontend precisa mapear `itens`, campos e status,
enviar XML em JSON com driverId e os campos foto/recebedor/dataHora, usar
conferencia e implementar compressão/retry. Este trabalho não redesenha telas
nem declara o produto integrado no navegador sem esse aceite.

Suporte a CT-e, renomeação de papéis/status e eventual retirada de PDF dependem
de decisão de contrato. Não foram implementados como mudanças silenciosas.
Jornada 5/aging/pacote, migração de histórico Git e ensaio de rollback não foram
incluídos nesta alteração de backend para CP3.
