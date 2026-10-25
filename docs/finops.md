# FinOps: situação de custos

Atualizado em 25/10/2026.

## Situação atual

- O projeto usa o id `demo-entregaprova` (ver `.firebaserc` no repositório de código). É um projeto de demonstração dos emuladores do Firebase: não existe na nuvem e não tem conta de faturamento vinculada.
- O desenvolvimento roda inteiro nos emuladores locais (Auth, Firestore e Storage) via Docker Compose, sem uso de recursos do Google Cloud.
- **Gasto acumulado: US$ 0,00** (teto do Checkpoint 2: US$ 5,00; teto do ciclo: US$ 50,00 por equipe).

## Pendência: alertas de orçamento (50/80/100%)

Os alertas de orçamento exigem um projeto real com conta de faturamento (plano Blaze), e o Blaze exige o cadastro de um cartão de crédito. Como a equipe ainda não decidiu quem cadastrará o cartão, o projeto real não foi criado e o alerta **não foi criado**. Isso é uma decisão consciente, não um esquecimento.

Plano:

1. O grupo define quem cadastra o cartão e como limitar o risco (por exemplo, cartão virtual com limite baixo), com a validação do tutor. Também será perguntado ao tutor se o curso oferece créditos ou uma conta de faturamento para as equipes.
2. Ao criar o projeto real, criar o orçamento de US$ 50 com alertas em 50%, 80% e 100% (US$ 25, 40 e 50).
3. Registrar aqui o print do console com os limites.

Prazo: antes do Checkpoint 3 (15/11), que exige Cloud Run e, portanto, faturamento.

## Controles previstos para a fase de nuvem

- `min-instances=0` no Cloud Run.
- Listas paginadas e queries controladas.
- Sem listeners grandes sem justificativa.
- Revisão de leituras e escritas do Firestore.

## Evidências

- `.firebaserc` com o id `demo-entregaprova` (print a incluir nesta pasta).