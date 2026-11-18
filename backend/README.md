# Backend

API Express/TypeScript publicada no Render, com Firebase Auth e Firestore.
Comprovantes de produção ficam no Supabase Storage privado. Firebase Storage
permanece apenas nos emuladores locais. Configuração e passos de implantação:
[guia operacional](../docs/runbooks/backend.md).

## Execução e validação

Usar Node 24 (dependências Firebase de testes exigem pelo menos 24.12).
Com as variáveis do ambiente configuradas:

```sh
npm ci
npm run lint
npm run build
npm run test:smoke
npm run test:emulator
npm run dev
```

`npm start` executa dist/server.js. `createApp(deps)` não abre porta nem inicializa
serviços reais; recebe auth, db, proofStorage e logger. O servidor monta os
adaptadores. Não configurar hosts de emuladores em produção.

## Autorização e rotas

Token Firebase verificado com custom claims tenantId e role
(admin/operator/driver). Sem tenant por header nem papel padrão. Documentos em
tenants/{tenantId}/deliveries/{chave44}. Motorista só acessa a própria entrega;
operator/admin importam e conferem. Security Rules deny-all para clientes.

| Método e caminho | Contrato |
| --- | --- |
| GET /healthz | Liveness sem dependências; revision com SHA Render |
| GET /readyz | Leitura leve Firestore, timeout de 2 s; 200/503 |
| GET /api/v1/entregas | itens/proximoCursor; filtros limit/cursor/status |
| POST /api/v1/entregas/xml | JSON xmlContent, driverId opcional; 201/409 |
| GET /api/v1/entregas/:id | Detalhe autorizado e link temporário da foto |
| POST /api/v1/entregas/:id/comprovantes | Multipart foto/recebedor/dataHora; Idempotency-Key |
| POST /api/v1/entregas/:id/conferencia | decisao APROVAR/REJEITAR; motivo na rejeição |

Aliases ingleses preservados: /deliveries, /deliveries/xml, /deliveries/:id,
/deliveries/:id/proof (file/recebedorNome/dataHoraEntrega) e PATCH
/deliveries/:id/check (aprovado/motivoRejeicao), todos sob /api/v1.
Aliases de saúde /api/v1/health, /api/v1/healthz e /api/v1/readyz preservados.

## Validações e comprovantes

XML até 1 MiB em bytes UTF-8; bloqueia DOCTYPE/ENTITY antes do parser; valida
NF-e 4.00, chave de 44 dígitos, módulo 11, cDV e campos obrigatórios, incluindo
emitente. Isso não é validação completa XSD nem de assinatura fiscal. Não há CT-e.

Comprovantes JPEG/PNG/WebP/PDF legado até 300000 bytes; confere MIME e assinatura
inicial. Nome e data/hora ISO com fuso obrigatórios. Documento do recebedor não
é persistido. Foto válida altera PENDENTE/REJEITADO para COMPROVADO; aprovação
gera CONFERIDO; rejeição com motivo gera REJEITADO. Novo envio limpa conferência.

Idempotency-Key aceita 1 a 128 caracteres alfanuméricos, _ ou -. Fingerprint
vincula usuário, entrega, campos e bytes. Mesma chave com outro conteúdo retorna
409. Duas transações Firestore reservam/finalizam a operação; upload fica fora
dos callbacks que podem repetir. A reserva dura 60 s e evita uploads concorrentes.
Supabase usa upsert=false; o emulador usa ifGenerationMatch=0. Retry após falha
reutiliza o arquivo determinístico sem sobrescrever.

Só o caminho privado é persistido; o cliente recebe link de até 15 min. Foto
removida aparece com arquivoDisponivel=false e URL/expiração nulas. Retry de
operação concluída cujo arquivo expirou retorna 410, sem recriar dados.
Retenção de 60 dias: `npm run cleanup:proofs` simula; `-- --apply` aplica.
Agendamento e permissões reais precisam ser configurados conforme o runbook.

## Evidência e limites

Lint/build e 99 testes passaram com Auth/Firestore/Storage emulados em
06/11/2026; um todo anterior sobre extensão de arquivo permanece. Quatro testes
Node cobrem smoke, publicação, configuração e retenção. O adaptador Supabase
usa SDK real com HTTP simulado; não houve verificação contra um bucket real.

CI preserva audit/gitleaks/Compose. Não houve push nem deploy nesta revisão.
O frontend ainda precisa mapear o contrato conforme o runbook. Logs contêm
somente campos operacionais, e CORS exige origens explicitamente autorizadas.
