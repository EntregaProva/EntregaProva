# Pacotes de comprovação pela API

Implementação da US-05. O contrato específico está em `openapi-pacotes.yaml`.
Os endpoints são adicionados à API existente, com Firebase Auth e Firestore.
Os comprovantes continuam no bucket privado existente do Supabase em produção.

## Solicitação e acompanhamento

1. Autenticar como `admin` ou `operator` e obter um ID token Firebase.
2. Enviar `POST /api/v1/pacotes-comprovacao` com `Authorization: Bearer TOKEN` e
   `Content-Type: application/json`.

```json
{
  "embarcadorId": "12345678000195",
  "entregaIds": ["35231012345678000195550010000001011234567891"],
  "formato": "ZIP",
  "inicio": "2026-11-01T00:00:00.000Z",
  "fim": "2026-11-30T23:59:59.999Z"
}
```

3. A resposta `202` traz `id`, `status: PROCESSANDO` e o header `Location` para
   `GET /api/v1/pacotes-comprovacao/{id}`. Consultar essa URL com o mesmo token.
   Usar intervalo de pelo menos dois segundos entre consultas.
4. Em `PRONTO`, abrir `urlDownload` resolvida contra a origem da API. O link
   relativo é uma capacidade assinada HMAC-SHA256 válida por 15 minutos, dispensando
   o token Firebase apenas no download. Quem receber o link poderá baixar o ZIP
   durante sua validade. Não registrar nem compartilhar a URL em logs ou tickets.
   Uma nova consulta autenticada fornece um novo prazo de download.
5. Em `FALHOU`, consultar `erro`, corrigir a seleção e criar outra solicitação.

## Conteúdo e decisões de domínio

O ZIP contém `resumo.json`, `manifesto.json` e `fotos/CHAVE44.ext`.
O manifesto registra SHA-256 do resumo e de cada comprovante. O resumo inclui
as notas, datas de importação, quantidade e valor total em reais.
JPEG, PNG, WebP e PDF legado conservam a extensão correspondente ao conteúdo.

Somente entregas `CONFERIDO` do tenant autenticado são aceitas. O limite é de
200 chaves únicas e 20 MiB de comprovantes por pacote. Seleções maiores devem
ser divididas. Nenhuma query varre toda a coleção de entregas.

Como o modelo atual não possui cadastro de embarcadores, `embarcadorId` é o
CNPJ do emitente presente nas posições 7 a 20 da chave NF-e. Essa equivalência
precisa ser confirmada com Produto se o embarcador comercial puder ser diferente
do emitente. O período opcional filtra `criadoEm` (importação), com limites
inclusivos; início e fim devem ser informados juntos em UTC com milissegundos.
As chaves são selecionadas pelo cliente e verificadas pelo servidor.

O papel `financeiro` ainda não existe no middleware do projeto. O acesso segue
os papéis atuais `admin` e `operator`, pendente de alinhamento com Produto.
Esta versão gera ZIP. A opção PDF mencionada no OpenAPI externo é recusada
explicitamente com `400`. O schema complementar versiona o contrato implementado
dentro de `backend/`; sua consolidação no repositório de documentação é pendente.

## Processamento, retomada e integridade

Cada solicitação é persistida em `tenants/{tenantId}/proofPackages/{id}` antes do
`202`. O processo inicia em segundo plano e usa uma reserva transacional de dez
minutos. Até dois trabalhos são processados por instância. Consultar um trabalho
pendente retoma sua execução quando houver capacidade e a reserva anterior tiver
expirado. Após uma queda do servidor, a retomada depende dessa consulta.
O prazo de coleta é de cinco minutos, respeitando o timeout do adaptador Storage.

O processamento salva metadados e hashes do snapshot do pacote. O ZIP é montado
no download a partir dos objetos privados e os hashes são conferidos novamente.
Isso evita criar outro bucket ou relaxar o limite de tipos do bucket existente.
Até dois downloads são montados simultaneamente por instância; excesso recebe
`429`. Se a política de retenção apagar um original, o link retorna `410`.
Se os bytes tiverem sido alterados, retorna `409`. Nenhum ZIP parcial é enviado.
O link expira independentemente do registro do pacote; esses registros não têm
limpeza automática nesta implementação. Não contêm fotos ou bytes do ZIP.

## Verificação local

Em `backend/` executar lint, build, smoke e `test:emulator`. Definir
`BACKEND_TEST_REPORT_DIR=coverage/api-packages` para manter os relatórios locais
dentro do backend. Os testes de contrato usam HTTP via Supertest, extraem o ZIP
e recalculam seus hashes. O teste de integração importa a NF-e, envia e aprova o
comprovante, solicita o pacote e baixa seu ZIP com Auth, Firestore e Storage
emulados. O adaptador Supabase é verificado com SDK real e HTTP simulado.
Validação com bucket Supabase real e homologação publicada são etapas posteriores.
