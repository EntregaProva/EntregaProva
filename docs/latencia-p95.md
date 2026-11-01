# Latência p95 do /healthz

Registro do teste de carga com o k6 sobre a API em produção.

## Como foi medido

- Data: 01/11/2026
- Ferramenta: k6 2.3.0, 30 segundos por rodada (rodada 1 com 10 usuários virtuais, rodada 2 com 5)
- Alvo: `https://entregaprova.onrender.com/healthz` (Render Free, região Oregon)
- Origem: máquina do DevOps (Windows, internet residencial no Brasil)
- Escopo: o `/healthz` não consulta o Firestore. O resultado mede a infraestrutura (rede até os EUA mais o Render Free), sem lógica de negócio. Não representa a latência dos endpoints reais.

## Resultado de referência (rodada 2: 5 usuários)

| Métrica | Valor |
|---|---|
| p95 | 251 ms |
| p90 | 244 ms |
| Mediana | 222 ms |
| Média | 237 ms |
| Mínimo | 208 ms |
| Máximo | 649 ms |

- Requisições: 124, todas com status 200 (0% de falhas).
- O limite do script (`p(95) < 1000 ms`) foi atendido.

## Rodada 1 (10 usuários)

| Métrica | Todas as requisições | Só as bem-sucedidas |
|---|---|---|
| p95 | 6,96 s | 298 ms |
| p90 | 298 ms | 275 ms |
| Mediana | 230 ms | 229 ms |
| Mínimo | 207 ms | 207 ms |
| Máximo | 21,62 s | 687 ms |

- Requisições: 95, das quais 90 com status 200 e 5 com falha (5,26%).
- O limite do script (`p(95) < 1000 ms`) não foi atendido por causa das falhas.
- As 5 falhas foram timeouts de conexão (cerca de 21 s cada), ocorridos quase ao mesmo tempo.

## Leitura dos resultados

- Nas duas rodadas, as requisições bem-sucedidas responderam com mediana entre 220 e 230 ms. Esse tempo inclui a distância da rede até Oregon.
- Não houve sinal de cold start: nenhuma resposta bem-sucedida passou de 700 ms.
- Com 10 usuários simultâneos apareceram 5 timeouts de conexão. Com 5 usuários, nenhum. Como foi apenas uma rodada de cada, não dá para afirmar se a causa foi a carga na instância Free ou uma instabilidade pontual de rede entre a máquina de teste e o Render.
- Por isso o valor de referência da baseline é o da rodada 2 (p95 de 251 ms), e a rodada 1 fica registrada como observação.

## Como reproduzir

Acorde a API abrindo o `/healthz` no navegador e rode, na raiz do repositório:

```
k6 run -e BASE_URL=https://entregaprova.onrender.com --vus 5 --duration 30s testes/carga/health.js
```

Instruções completas, incluindo a opção com Docker, em `testes/carga/README.md`. Rodar só contra o `/healthz`, nunca contra o `/readyz` nem contra endpoints que usam o Firestore.

## Evidências

- Latência p95 do `/healthz` (k6): `latencia-p95.md` e `k6-p95-healthz.png` nesta pasta.