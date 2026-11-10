# Contrato de integração do frontend EntregaProva

Baseado nas rotas atuais em `backend/src/routes/index.ts` e nos campos de `backend/src/controllers/delivery.controller.ts` (checkout local lido em 04/11/2026).

## Geral

- Base local: `http://localhost:3000/api/v1`.
- Todas as rotas de jornada exigem `Authorization: Bearer <Firebase ID token>`.
- Empresa e papel vêm das claims `tenantId` e `role`; papéis aceitos: `admin`, `operator`, `driver`.
- A resposta atual do backend usa nomes em português e status `PENDENTE`, `COMPROVADO`, `CONFERIDO`, `REJEITADO`. O frontend os adapta para seus tipos e rótulos.

## Rotas disponíveis no backend

| Operação | Rota e corpo aceitos | Resposta observada |
|---|---|---|
| Importar NF-e | `POST /deliveries/xml`, JSON `{ xmlContent, driverId }`; `driverId` é opcional no backend | Entrega com `id`, `numeroNF`, `chaveNFe`, `destinatario`, `status`, `criadoEm` |
| Ler uma entrega | `GET /deliveries/{id}`; ID deve ter 44 dígitos | Entrega; se houver comprovante, inclui `arquivoUrl` e `expiraEm` assinados por 15 min |
| Enviar comprovante | `POST /deliveries/{id}/proof`, multipart `file`, `recebedorNome`, `dataHoraEntrega`; header `Idempotency-Key` | Resultado parcial do upload, não uma entrega completa |
| Conferir | `PATCH /deliveries/{id}/check`, JSON `{ aprovado: boolean, motivoRejeicao?: string }` | ID, status atualizado e dados da conferência |

O backend também mantém aliases em português (`/entregas/xml`, `/entregas/{id}`, `/entregas/{id}/comprovantes`, `/entregas/{id}/conferencia`).

## Bloqueios de backend para as telas de lista

- `GET /deliveries` ainda não existe. A lista principal e a tela de captura continuarão em erro até o backend implementar uma consulta paginada por tenant e, para `driver`, por UID do motorista.
- `GET /deliveries/review` ainda não existe. O backend precisa implementá-la antes de `GET /deliveries/:id`, filtrar `COMPROVADO`, restringir a `admin`/`operator` e fechar o formato paginado.
- Esta cópia espera que a fila retorne IDs de entrega; para cada ID, o frontend chama a leitura autorizada `GET /deliveries/{id}` e usa a URL assinada. O backend deve confirmar esse formato na reunião de contrato.
- O backend aceita `driverId` mas não valida que o UID pertence a um motorista da mesma empresa. A importação pede o UID; a seleção segura depende de uma rota/consulta de motoristas autorizados e validação no backend.

## Limites que ainda divergem

- O parser aceita apenas NF-e 4.00; CT-e não está implementado.
- O backend aceita JPEG, PNG e PDF até 5 MiB. A cópia revisada comprime fotos no navegador para JPEG até 1280 px e até 300 KiB, conforme a meta anotada no feedback. Se 300 KiB for regra do cliente, o backend ainda deve reduzir o limite para 300 KiB e devolver 413 acima dele.
- Leitura de foto usa URL assinada com validade de 15 minutos. O frontend precisa recarregar a fila/leitura quando a URL expirar.

## Tipos adaptados na interface

```ts
interface Delivery {
  id: string;
  invoiceNumber: string;
  accessKey: string;
  recipient: string;
  status: "PENDENTE" | "COMPROVADO" | "CONFERIDO" | "REJEITADO" | string;
  createdAt: string;
  proof?: { photoUrl: string; receiverName: string; capturedAt: string; expiresAt?: string };
}
```
