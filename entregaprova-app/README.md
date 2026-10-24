# EntregaProva (Frontend)

React + Vite + TypeScript, com o design do painel já convertido.
O CSS do design está em `src/style.css`. O Tailwind está instalado e ligado
(sem o "reset" dele, para não mudar o visual), pronto para ser usado nas próximas telas.

A bolinha no topo mostra o estado da API. Enquanto o backend não existir, ela fica vermelha ("API indisponível"): é o esperado.

## Verificações (as mesmas do CI)
- `npm run lint`
- `npm run build`

## Rodar com Docker
1. Abra o Docker Desktop
2. `docker compose up --build` → abra http://localhost:5173

## O que tem em cada lugar
- `src/App.tsx` — monta a página e guarda o estado (busca, entregas, avisos)
- `src/components/` — pedaços da tela (menu, topo, indicadores, gráfico, tabela, formulário)
- `src/delivery.ts` — tipo de dados e as entregas de demonstração
- `src/style.css` — o CSS do design
- `public/logo-entregaprova.png` — o logo
- `docs/design/prototipo-original/` — o protótipo HTML/CSS/JS original, guardado como referência

## Pontos de atenção
Os números, o gráfico e as entregas são dados de demonstração (da minha cabeça) escritos no código.
Nada é enviado nem salvo. Esse trabalho é com a API do backend.
