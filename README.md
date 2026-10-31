# EntregaProva
Menos papelada, mais eficiência.  
Projeto B2B — AI Lab Makers | Engenharia de Software | 2026.2

O EntregaProva é uma plataforma de logística documental voltada para transportadoras regionais, que facilita a captura, conferência e organização de comprovantes de entrega. A solução busca digitalizar a captura e a conferência de comprovantes, relacioná-los aos documentos fiscais da operação e facilitar o acompanhamento das entregas pendentes de comprovação. Dessa forma, pretende reduzir a perda de documentos, os atrasos no faturamento dos fretes e o retrabalho operacional.

## Equipe responsável
Grupo 3 do Projeto de Extensão Makers do AI Lab da UnB (Universidade de Brasília)
| Integrante | Responsabilidade |
|---|---|
| Maria Luisa Oliveira Lima | Product Owner (PO) |
| João Pedro Pellegrini de Almeida | Tech Lead |
| Ana Teresa Schneider Brandão | Frontend |
| João Victor Pereira Santos | Backend |
| Marcelo Vitor Machado da Silva Filho | Quality Assurance (QA) |
| Felipe Júnior Duarte da Silva | DevOps |

## Sobre o projeto 
A proposta é digitalizar o caminho entre a entrega realizada e sua comprovação, centralizando informações e facilitando o trabalho das equipes operacionais e financeiras. O objetivo é fazer um sistema realmente funcional que seja capaz de realizar o fluxo completo: importar documentos fiscais, registrar o comprovante pelo celular, conferir a entrega e gerar a documentação necessária ao faturamento.

### Fluxo esperado e Funcionalidades do projeto
**Fluxo de funcionamento:**  
1. Importar: carregar os documentos fiscais em XML.  
2. Organizar: identificar e registrar as entregas pendentes de comprovação.
3. Capturar: registrar a fotografia do comprovante e os dados do recebimento pelo celular.  
4. Conferir: comparar os registros com as informações fiscais disponíveis.  
5. Acompanhar: visualizar pendências e o tempo decorrido até a comprovação.  
6. Consolidar: gerar um pacote documental para apoiar o faturamento.  

**Funcionalidades:**  
- **Importação de XML:** identificação de entregas a partir de NF-e e CT-e.
- **Comprovantes digitais:** captura de fotos e registro dos dados do recebimento pelo celular.
- **Conferência inteligente:** comparação dos comprovantes com os dados fiscais disponíveis.
- **Painel de pendências:** acompanhamento de entregas, atrasos e pendências por embarcador.
- **Pacote de comprovação:** organização dos documentos para apoiar o faturamento.

### Tecnologias do projeto
- **Backend:** Node 22 LTS, TypeScript, Express e Firebase Admin
- **Frontend:** Vite (`entregaprova-app`)
- **Autenticação, banco e arquivos:** Firebase Auth, Firestore e Storage (emuladores locais nesta fase)
- **Ambiente:** Docker e Docker Compose
- **Testes e qualidade:** Vitest, ESLint e GitHub Actions (CI)

## Como subir o projeto

Tudo roda localmente com Docker Compose e emuladores do Firebase. Nenhuma conta de nuvem, cartão ou segredo real é necessário.

### Pré-requisitos

- Docker e Docker Compose
- Git
- Node 22 LTS (apenas para rodar testes ou scripts fora do Docker)

### Passo a passo

1. Clone o repositório:
   ```bash
   git clone https://github.com/EntregaProva/EntregaProva.git
   cd EntregaProva
   ```
2. Crie o arquivo de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env
   ```
   Todos os valores do `.env.example` são falsos e já funcionam com os emuladores (projeto `demo-entregaprova`). Não é preciso alterar nada.
3. Suba todos os serviços:
   ```bash
   docker compose up --build
   ```
   O `compose.yaml` da raiz inclui o `docker/docker-compose.yml`, que define o backend, o frontend e os emuladores.
4. Em outro terminal, popule os emuladores com os dados de exemplo:
   ```bash
   docker compose exec backend npm run seed
   ```
   O seed é reproduzível: apaga e recria sempre os mesmos usuários no emulador de Auth. Ele recusa rodar fora dos emuladores.

Para parar tudo: `docker compose down`. Para apagar também os dados: `docker compose down -v`.

### Serviços e portas

| Serviço | URL |
|---|---|
| Frontend (`entregaprova-app`, Vite) | http://localhost:5173 |
| API (`backend`) | http://localhost:3000 |
| Emulador de Auth | http://localhost:9099 |
| Emulador de Firestore | http://localhost:8080 |
| Emulador de Storage | http://localhost:9199 |
| UI dos emuladores | http://localhost:4000 |

### Usuários de teste

Criados pelo seed no emulador de Auth.

| Papel | E-mail | Senha |
|---|---|---|
| Admin / painel | admin@teste.com | Teste@123 |
| Motorista | motorista@teste.com | Teste@123 |

### Variáveis de ambiente

O `.env.example` é dividido em três blocos:

| Bloco | Variáveis | Observação |
|---|---|---|
| Geral | `NODE_ENV`, `GCP_PROJECT_ID` | O prefixo `demo-` garante que os emuladores nunca tocam na nuvem |
| Backend | `PORT`, `STORAGE_BUCKET`, `*_EMULATOR_HOST` | O Compose já injeta os hosts dos emuladores. Só preencha se rodar a API fora do Docker |
| Frontend (Vite) | `VITE_*` | Apontam para a API e para os emuladores locais |

O arquivo `.env` real nunca vai para o GitHub.

### Verificação rápida

- `GET http://localhost:3000/healthz` responde 200.
- `GET http://localhost:3000/readyz` responde 200.
- O login com um usuário de teste abre a tela inicial.
- A UI dos emuladores (http://localhost:4000) mostra os usuários criados pelo seed.

### Problemas comuns

- **Porta ocupada:** pare o processo que a usa ou altere a porta no `.env`.
- **Emuladores sem dados:** rode o seed de novo.
- **Alterou o `.env`:** `docker compose down && docker compose up --build`.
- **Dados antigos atrapalhando:** `docker compose down -v` e suba de novo.
- **Rodando a API fora do Docker:** preencha no `.env` os três `*_EMULATOR_HOST` apontando para `localhost`.

## Testes e qualidade

Dentro de `backend/`:

```bash
npm ci
npm run lint
npm run build
npm test
```

Os testes cobrem autorização, EP/BVA e Security Rules (estes últimos rodam contra o emulador). O CI executa lint, build e testes em Node 22 a cada PR.

## Estrutura do repositório

| Pasta / arquivo | Conteúdo |
|---|---|
| `backend/` | API em TypeScript (Express + Firebase Admin), com `src/` e `tests/` |
| `entregaprova-app/` | Frontend |
| `docker/` | Dockerfiles e `docker-compose.yml` (backend, frontend e emuladores) |
| `compose.yaml` | Ponto de entrada do Compose (inclui `docker/docker-compose.yml`) |
| `firebase.json` | Configuração dos emuladores |
| `firestore.rules` / `storage.rules` | Security Rules (deny-all: o acesso é só pela API) |
| `testes/` | Testes de autorização, EP/BVA e Security Rules |
| `docs/` | Documentação (ADRs, FinOps, rastreabilidade, relatórios de teste) |
| `.github/` | Workflow de CI, CODEOWNERS e template de PR |

## Documentação

A documentação (ADRs, FinOps, rastreabilidade e relatórios de teste) fica em um repositório separado:

https://github.com/EntregaProva/EntregaProva-documentation

**| EntregaProva — Da entrega à comprovação, com mais controle e eficiência.**