# Contrato proposto para integração do front-end

Este documento registra os formatos esperados pelo front-end. No repositório atual, o backend implementa apenas `GET /api/v1/health`; todas as outras rotas abaixo são uma proposta para alinhamento com o responsável pelo backend, não endpoints já disponíveis.

## Geral

- Base local: `http://localhost:3000/api/v1`.
- Requisições autenticadas: `Authorization: Bearer <Firebase ID token>`.
- Erros JSON: preferir `{ "message": "..." }`.
- Todas as entregas devem ser filtradas pela empresa (tenant) e papel do token no backend.

## Entrega

`Delivery`:

```json
{
  "id": "id estável",
  "invoiceNumber": "número NF-e/CT-e",
  "accessKey": "chave fiscal",
  "recipient": "destinatário",
  "status": "pendente | capturada | conferida | divergente",
  "createdAt": "data ISO 8601"
}
```

| Método e caminho | Corpo | Resposta esperada |
|---|---|---|
| `GET /deliveries` | — | `Delivery[]` |
| `POST /deliveries/import-xml` | multipart `file` (XML NF-e/CT-e) | `Delivery` criada |
| `POST /deliveries/{id}/proof` | multipart `photo`, `receiverName`, `capturedAt`; header `Idempotency-Key` | `Delivery` atualizada |
| `GET /deliveries/review` | — | `ReviewItem[]` pendentes de conferência |
| `POST /deliveries/{id}/review` | JSON `{ decision: "approved" | "rejected", reason?: string }` | 204 ou registro atualizado |

## Item para conferência

```json
{
  "deliveryId": "id estável",
  "invoiceNumber": "...",
  "accessKey": "...",
  "recipient": "...",
  "xml": { "invoiceNumber": "...", "accessKey": "...", "recipient": "..." },
  "proof": { "photoUrl": "URL autorizada", "receiverName": "...", "capturedAt": "data ISO 8601" }
}
```

A URL da foto deve ter autorização compatível com a sessão (por exemplo, URL assinada de curta duração). Não expor arquivos de outras empresas. O backend valida MIME, tamanho, ownership, tenant e papel do usuário; as validações de interface não substituem isso.

## Alinhamentos necessários

1. Confirmar os nomes das rotas, campos e status com o OpenAPI do backend.
2. Confirmar o status que indica fila de conferência e o que aparece após aprovar/rejeitar.
3. Confirmar limite e tipos de XML/foto, idempotência e como a imagem autenticada será lida.
4. Implementar verificação do Firebase ID token e isolamento por tenant em cada rota de jornada.
