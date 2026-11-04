# EntregaProva - frontend para revisão

Aplicação React, Vite e TypeScript para o painel de entregas. Esta cópia remove o arquivo legado com `INITIAL_DELIVERIES` e ajusta as chamadas às rotas que o backend já implementa.

## Rodar junto ao backend

O modo recomendado está descrito no README da raiz do repositório. Com Docker Desktop e virtualização disponíveis, na raiz do projeto:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Em outro terminal, o README da raiz orienta executar `docker compose exec backend npm run seed`. No estado do seed lido em 04/11/2026, as claims ainda não satisfazem o middleware (`tenantId` ausente e papel `motorista` em vez de `driver`); portanto o login pode ocorrer, mas as chamadas protegidas serão recusadas até o backend corrigir o seed.

## Limite de funcionamento ponta a ponta

As telas de lista chamam `GET /api/v1/deliveries` e `GET /api/v1/deliveries/review`, que ainda não existem no backend deste checkout. Elas mostram o estado de erro da API e permitem nova tentativa; nenhum dado estático é usado como substituto. As rotas de importação, envio de comprovante, leitura individual e conferência foram alinhadas às rotas existentes. Veja `docs/FRONTEND_API_CONTRACT.md` e `REVISAO_CP2.md` para dependências e divergências restantes.

## Desenvolvimento direto

O `.env` fica na raiz do repositório. O Vite executado diretamente dentro desta pasta não carrega automaticamente o arquivo pai; configure as variáveis `VITE_*` no ambiente antes de iniciar `npm run dev`. Não inclua `.env` neste pacote.

## O que foi ajustado nesta cópia

- Importação envia o conteúdo do XML em JSON para `POST /deliveries/xml` e pede o UID do motorista.
- Respostas do backend são adaptadas dos campos em português para os nomes usados pelos componentes.
- Comprovante usa multipart `file`, campos `recebedorNome` e `dataHoraEntrega`, com `Idempotency-Key`.
- Conferência usa `PATCH /deliveries/{id}/check` e os status reais do backend.
- Captura filtra `PENDENTE` e `REJEITADO`, comprime a foto no navegador e preserva a mesma tentativa/chave ao repetir a operação.
- O menu usa o papel nas claims do token para mostrar ações por perfil.

Esta cópia é para revisão. As pendências de backend e DevOps continuam descritas no relatório incluso.
