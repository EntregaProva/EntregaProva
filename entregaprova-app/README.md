# EntregaProva — frontend

Este pacote contém apenas `entregaprova-app`. Não inclui backend, workflows, `.env`, `node_modules` ou `dist`.

## Autenticação local

Com Docker e Firebase Auth Emulator ativos na porta 9099, crie as contas de teste executando na raiz do repositório:

```bash
docker compose up --build
docker compose exec backend npm run seed
```

O backend precisa criar custom claims `role` com valor `admin`, `operator` ou `driver`, e uma claim `tenantId` válida. O frontend verifica as duas claims antes de abrir o painel. Se o Auth Emulator não estiver rodando, as contas de teste não entram.

Contas esperadas no seed local:

| Papel | E-mail | Senha |
| --- | --- | --- |
| Admin | `admin@teste.com` | `Teste@123` |
| Motorista | `motorista@teste.com` | `Teste@123` |

## Contrato da API

A importação usa JSON `{ xmlContent, driverId }`; `xmlContent` carrega o XML como texto. Os status aceitos são `PENDENTE`, `COMPROVADO`, `CONFERIDO` e `REJEITADO`.

Neste checkout ainda faltam no backend `GET /api/v1/deliveries` e `GET /api/v1/deliveries/review`, necessárias para lista, captura e conferência. Detalhes em `docs/FRONTEND_API_CONTRACT.md`.

Para Firebase real/publicado, é necessário habilitar Email/Senha, configurar a chave Firebase Web no build e criar usuários com as claims esperadas. Os workflows que fazem isso ficam fora deste pacote frontend-only.

Veja `docs/FRONTEND-ONLY-CHANGES.md` para o resumo do que foi alterado.
