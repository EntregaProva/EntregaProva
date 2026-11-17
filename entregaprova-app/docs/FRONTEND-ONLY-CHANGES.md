# Alterações somente do frontend

Esta versão contém apenas a pasta `entregaprova-app`. Nenhum backend, seed, workflow, deploy ou arquivo de ambiente faz parte deste pacote.

## O que foi alterado

- `src/api/deliveries.ts`: normaliza status recebidos para maiúsculas e valida contra os valores aceitos. O XML é enviado como JSON com `xmlContent` contendo o XML em texto.
- `src/api/client.ts`: tenta GET novamente por até 10 s em falhas de rede/5xx transitórias; não repete uploads nem outras escritas.
- `src/firebase.ts`: exibe erro de configuração no próprio login em vez de interromper a inicialização e produzir tela branca.
- `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts` e `src/App.tsx`: atualizam/verificam as claims `role` e `tenantId` e mostram qual delas falta.
- `src/pages/LoginPage.tsx` e `src/pages/LoginPage.css`: criam uma página inicial responsiva com seções para rolar e login em modal. O formulário do modal continua usando `signIn` do Firebase; mantém a saudação, os rótulos e os botões “Entrar” e “Criar uma conta”.
- `public/logo-entregaprova.png`: usa a logo enviada pela equipe, recortada para remover transparência externa e exibida no cabeçalho, modal e rodapé.
- `src/index.css` e `index.html`: carregam Poppins pelos arquivos locais em `public/fonts`, sem depender do Google Fonts.

## O que precisa de Backend/DevOps

- O seed do backend precisa criar `tenantId` e usar `driver` (o middleware não aceita `motorista`). Essa correção não está aplicada ao repositório nem incluída neste ZIP.
- O Auth Emulator precisa estar ativo na porta 9099 para contas locais. O frontend não consegue iniciá-lo.
- Para produção, o projeto Firebase precisa ter Email/Senha habilitado, usuários com claims válidas e a chave Web disponível no build. A configuração dos workflows é responsabilidade DevOps e não está neste pacote.
- `GET /api/v1/deliveries` e `GET /api/v1/deliveries/review` ainda não existem no backend; sem elas, lista/captura/conferência não completam.

Validação realizada na cópia: `npm run lint` e `npm run build` passaram. O login real depende do Firebase configurado e do emulador local ativo.
