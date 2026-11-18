# Contrato de integração do frontend EntregaProva

Baseado nas rotas do backend e nos campos de `delivery.controller.ts` e `delivery-list.service.ts`.

## Geral

- Base local: `http://localhost:3000/api/v1`.
- Todas as rotas de jornada exigem `Authorization: Bearer <Firebase ID token>`.
- Empresa e papel vêm das claims `tenantId` e `role`; papéis aceitos: `admin`, `operator`, `driver`.
- A resposta atual do backend usa nomes em português e status `PENDENTE`, `COMPROVADO`, `CONFERIDO`, `REJEITADO`. O frontend os adapta para seus tipos e rótulos.

## Rotas disponíveis no backend

| Operação | Rota e corpo aceitos | Resposta observada |
|---|---|---|
| Listar entregas | `GET /deliveries`, com `cursor` e `status` opcionais | `{ itens, proximoCursor }` |
| Importar NF-e | `POST /deliveries/xml`, JSON `{ xmlContent, driverId }`; `driverId` é opcional no backend | Entrega com `id`, `numeroNF`, `chaveNFe`, `destinatario`, `status`, `criadoEm` |
| Ler uma entrega | `GET /deliveries/{id}`; ID deve ter 44 dígitos | Entrega; se houver comprovante, inclui `arquivoUrl` e `expiraEm` assinados por 15 min |
| Enviar comprovante | `POST /deliveries/{id}/proof`, multipart `file`, `recebedorNome`, `dataHoraEntrega`; header `Idempotency-Key` | Resultado parcial do upload, não uma entrega completa |
| Conferir | `PATCH /deliveries/{id}/check`, JSON `{ aprovado: boolean, motivoRejeicao?: string }` | ID, status atualizado e dados da conferência |

O backend também mantém aliases em português (`/entregas/xml`, `/entregas/{id}`, `/entregas/{id}/comprovantes`, `/entregas/{id}/conferencia`).

## Listagem e fila de conferência

- Entregas e captura leem `itens` e enviam `proximoCursor` como `cursor` da próxima página. O backend aplica o tenant e, para `driver`, o UID do motorista.
- A fila usa `GET /deliveries?status=COMPROVADO`. O detalhe da entrega selecionada fornece a URL temporária no campo `comprovante.arquivoUrl`.
- Um comprovante indisponível impede a decisão sobre a entrega selecionada. A fila continua acessível para escolher outra entrega.
- O backend aceita `driverId` mas não valida que o UID pertence a um motorista da mesma empresa. A importação pede o UID; a seleção segura depende de uma rota/consulta de motoristas autorizados e validação no backend.

## Limites que ainda divergem

- O parser aceita apenas NF-e 4.00; CT-e não está implementado.
- O backend aceita JPEG, PNG e PDF até 5 MiB. A cópia revisada comprime fotos no navegador para JPEG até 1280 px e até 300 KiB, conforme a meta anotada no feedback. Se 300 KiB for regra do cliente, o backend ainda deve reduzir o limite para 300 KiB e devolver 413 acima dele.
- A URL assinada vale 15 minutos. A ação **Atualizar comprovante** consulta novamente o detalhe da entrega.

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
