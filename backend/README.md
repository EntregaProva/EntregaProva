# Backend — CP2 e preparação do CP3

Execute `npm ci`, `npm run lint`, `npm run build` e `npm test` nesta pasta.
`npm test` inclui checagem de tipos dos testes e execução do Vitest.
`npm run dev` inicia o servidor; `npm start` usa o build de `dist`.

## Inicialização e autenticação

`createApp(deps)` em `src/app.ts` recebe `auth`, `db`, `storage` e `logger`.
Importar a fábrica não inicializa Firebase nem abre uma porta. Somente `server.ts`
monta as dependências reais. O logger real escreve uma linha JSON por evento.

As rotas de negócio exigem token Firebase verificado com custom claims `tenantId`
e `role` (`admin`, `operator` ou `driver`). Não há fallback de tenant por header ou
de papel. A identidade não é aceita pelo corpo da requisição.

Os documentos são gravados em `tenants/{tenantId}/deliveries/{chave44}`.
O motorista só acessa entregas cujo `driverId` corresponde ao UID autenticado.
Operadores podem informar `driverId` na importação. Uma entrega sem motorista
atribuído não pode ser acessada por um motorista; o administrador pode operá-la.
As regras deny-all existentes continuam aplicadas aos clientes: o backend usa
Admin SDK e faz sua própria autorização.

## Rotas

| Método e caminho | Entrada / comportamento |
| --- | --- |
| `GET /healthz` | Liveness sem autenticação, Firestore ou Storage |
| `GET /readyz` | Leitura de `_system/readiness`; 200 ou 503, timeout de 2 s |
| `POST /api/v1/entregas/xml` | JSON `xmlContent`, `driverId` opcional; operador/admin |
| `GET /api/v1/entregas/{chave44}` | Leitura autorizada; URL temporária quando há comprovante |
| `POST /api/v1/entregas/{chave44}/comprovantes` | Multipart `foto`, `recebedor`, `dataHora`; motorista/admin; header `Idempotency-Key` |
| `POST /api/v1/entregas/{chave44}/conferencia` | JSON `decisao: APROVAR ou REJEITAR`, `motivo` obrigatório na rejeição; operador/admin |

Os aliases `/api/v1/health`, `/api/v1/healthz` e `/api/v1/readyz` foram mantidos.
As rotas anteriores `/api/v1/deliveries/xml`, `GET /api/v1/deliveries/{id}`,
`POST /api/v1/deliveries/{id}/proof` (campo `file`, `recebedorNome`,
`dataHoraEntrega`) e `PATCH /api/v1/deliveries/{id}/check` (booleano `aprovado`,
`motivoRejeicao`) também funcionam. `{id}` agora é sempre a chave de 44 dígitos.

## Validações e dados

O limite de XML foi definido como 1 MiB (1.048.576 bytes UTF-8), sem o envelope
JSON. A aplicação verifica tamanho, rejeita DOCTYPE/ENTITY antes do parser,
valida sintaxe e estrutura NF-e versão 4.00 e verifica chave/módulo 11 e `ide/cDV`.
São aceitos envelopes `NFe` e `nfeProc`. Isso não é validação completa de XSD nem
verificação de assinatura fiscal. A importação duplicada retorna 409.

O comprovante aceita JPEG, PNG ou PDF, até 5 MiB, com conferência da assinatura
inicial do arquivo além do MIME. A data/hora deve ser ISO com fuso. O documento
do recebedor é ignorado e não é persistido: ficam apenas o nome e os metadados
operacionais do comprovante. Registros antigos não são migrados automaticamente.

A conferência só aceita entregas COMPROVADO. Aprovar produz CONFERIDO; rejeitar
produz REJEITADO. PENDENTE e REJEITADO permitem envio de comprovante. Novo envio
limpa a conferência anterior e passa a COMPROVADO.

## Idempotência e Storage

O registro fica em `tenants/{tenantId}/idempotency/{key}`. A chave aceita de 1 a
128 caracteres alfanuméricos, `_` e `-`. Um hash vincula entrega, usuário, nome,
data/hora, MIME e conteúdo do arquivo à chave. Outra operação com a mesma chave
retorna 409; uma operação finalizada devolve o resultado com nova URL assinada.

A primeira transação reserva a operação e a entrega por 60 s. O upload acontece
fora da transação, em caminho determinístico, usando `ifGenerationMatch: 0` para
não sobrescrever objetos. A segunda transação verifica o dono da reserva e
finaliza entrega e idempotência juntas. Uma chamada em andamento retorna 409.
Depois de uma falha, repita a mesma requisição e chave após a reserva expirar.
Se o arquivo já foi salvo, a repetição reutiliza o objeto sem sobrescrevê-lo.

Firestore e Storage não compartilham uma transação atômica. Se uma operação
for abandonada após salvar o arquivo, pode sobrar um objeto sem referência;
uma rotina de reconciliação/limpeza pode ser adicionada posteriormente.

Somente o caminho privado do objeto é persistido. As URLs de leitura são V4,
válidas por 15 minutos. O ambiente real precisa de uma identidade com permissão
para assinar URLs e acessar o bucket. O emulador de Storage sozinho não fornece
credenciais de assinatura; os testes locais substituem a assinatura.

## Evidência e limites

Os testes exercitam as rotas Express com Supertest e dependências substituídas,
incluindo uma implementação de transações em memória com rollback e serialização.
Eles não substituem a execução contra emuladores ou serviços reais do Firebase,
nem validam IAM, contenção distribuída ou o conteúdo visual dos comprovantes.

O CI preserva os jobs de lint/build e Docker Compose do DevOps e acrescenta
`npm test` apenas ao backend. O documento completo do tutor não está neste
workspace; os 19 itens da Seção 7 ainda devem ser reconciliados com ele.

A branch foi iniciada na main. Isso não remove XMLs presentes no histórico da
própria main; nenhum histórico foi reescrito.
