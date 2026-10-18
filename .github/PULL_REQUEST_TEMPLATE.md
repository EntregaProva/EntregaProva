## Resumo
Descreva a alteração e o motivo.

## Tarefa relacionada
Informe a sprint e o link ou identificador da issue ou tarefa.

## Tipo de alteração
- [ ] Nova função
- [ ] Correção de bug
- [ ] Refatoração
- [ ] Documentação
- [ ] Testes
- [ ] Configuração
- [ ] Outros: 

## Resultado esperado
Descreva o comportamento esperado após a alteração.

## Pendências
Ficou faltando resolver algo relacionado a esta tarefa?

## Checklist do autor
## 1. Itens obrigatórios 

- [ ] **Revisão e CI:** PR revisado por alguém diferente do autor e CI verde.
- [ ] **Teste ligado a critério de aceite:** existe pelo menos um teste novo que verifica um critério de aceite da história
- [ ] **Sem segredos no código:** nenhuma senha, chave ou token no código nem no histórico do commit. Só o `.env.example` vai para o GitHub.
- [ ] **Estados de tela:** toda tela nova ou alterada tem estado de carregando, vazio e erro.
- [ ] **Logs sem dados pessoais:** nenhum log contém nome, CPF, telefone, e-mail ou foto de comprovante.
- [ ] **Controle de custos:** nenhum recurso novo no GCP/Firebase sem ADR ou aprovação do Tech Lead.

## 2. Itens específicos 

Aplicam-se quando a tarefa toca no assunto indicado.

- [ ] **Configuração:** se surgiu variável de ambiente nova, o `.env.example` foi atualizado.
- [ ] **Contrato da API:** se um endpoint mudou, o OpenAPI foi atualizado no mesmo PR.
- [ ] **Isolamento de tenant:** se a tarefa lê ou grava dados por empresa, o teste de isolamento passa.
- [ ] **XML seguro:** se a tarefa processa XML (NF-e/CT-e), o parser está com entidades externas desabilitadas (proteção contra XXE) e há teste com XML malicioso.
- [ ] **Upload sem duplicação:** se a tarefa envolve envio de imagem, reenviar o mesmo comprovante não cria registro duplicado (idempotência).
