# Configurar o login/histórico sincronizado (Firebase)

O app agora tem tela de login/cadastro e o histórico sincroniza entre
dispositivos. Isso precisa de um projeto gratuito no Firebase (Google) —
sem cartão de crédito, plano "Spark" (gratuito) resolve numa boa para
até 100 usuários.

## 1. Criar o projeto

1. Acesse **https://console.firebase.google.com/**
2. Clique em **"Adicionar projeto"**, dê um nome (ex.: `prompt-facil`) e conclua a criação.
   Não é necessário ativar o Google Analytics.

## 2. Ativar login por Email/Senha

1. No menu lateral, vá em **Build > Authentication**.
2. Clique em **"Vamos começar"**.
3. Na aba **"Sign-in method"**, ative o provedor **"Email/senha"**.

## 3. Criar o banco de dados (Firestore)

1. No menu lateral, vá em **Build > Firestore Database**.
2. Clique em **"Criar banco de dados"**.
3. Escolha o modo **produção** (vamos colar regras de segurança customizadas no passo 5)
   e a localização mais próxima de você (ex.: `southamerica-east1`).

## 4. Pegar as chaves de configuração

1. Clique na engrenagem (⚙) ao lado de "Visão geral do projeto" > **"Configurações do projeto"**.
2. Em **"Seus apps"**, clique no ícone **`</>`** (Web) para criar um app da Web.
3. Dê um apelido (ex.: `prompt-facil-web`) e clique em **"Registrar app"**.
4. Copie o objeto `firebaseConfig` que aparecer e cole em **`firebase-config.js`**,
   substituindo os valores `"COLE_AQUI"`.

## 5. Colar as regras de segurança do Firestore

Isso é o que garante que:
- cada usuário só acessa o **próprio** histórico;
- o limite de **100 contas gratuitas** é respeitado de verdade (não só na tela).

Vá em **Firestore Database > Regras** e substitua tudo pelo conteúdo abaixo,
depois clique em **"Publicar"**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Contador global de contas criadas (usado para o limite de 100 vagas).
    // Leitura liberada para qualquer um (mesmo deslogado) só para mostrar
    // "restam X vagas" na tela de login. Escrita só pode SOMAR 1 (novo cadastro,
    // até no máximo 100) ou SUBTRAIR 1 (exclusão de conta, até no mínimo 0) por vez
    // — isso é o que impede burlar o limite.
    match /meta/stats {
      allow read: if true;
      allow update: if request.auth != null
                    && (
                         (request.resource.data.userCount == resource.data.userCount + 1
                          && request.resource.data.userCount <= 100)
                         ||
                         (request.resource.data.userCount == resource.data.userCount - 1
                          && request.resource.data.userCount >= 0)
                       );
      allow create: if request.auth != null
                    && request.resource.data.userCount <= 100;
    }

    // Perfil do usuário (nome, email, data de criação, consentimento).
    match /users/{uid} {
      allow create: if request.auth != null && request.auth.uid == uid;
      allow read, update, delete: if request.auth != null && request.auth.uid == uid;

      // Histórico de prompts do usuário — só o próprio dono lê/escreve/apaga.
      match /prompts/{promptId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }

      // Prompts favoritados pelo usuário — mesma regra do histórico: só o dono acessa.
      match /favorites/{favoriteId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Prompts compartilhados por link — feature nova. Fica FORA de /users/{uid}
    // porque quem abre o link é outra conta, não o dono.
    // - "get" (abrir um link específico, sabendo o ID): qualquer pessoa logada.
    // - "list" (listar em massa): só é permitido quando a query já filtra pelo
    //   próprio uid como dono (usado no painel "🔗 Links"), então ninguém
    //   consegue listar/descobrir links de outras pessoas por aí.
    // - Criar/apagar: só quem é dono do link.
    match /sharedPrompts/{shareId} {
      allow get: if request.auth != null;
      allow list: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      allow update: if false;
    }

    // Biblioteca pública de prompts — feature nova. Publicação é sempre manual
    // (a pessoa escolhe no histórico/favoritos), e fica ativa até o dono apagar.
    match /publicPrompts/{promptId} {
      allow get: if request.auth != null;
      allow list: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      // Único "update" permitido é o app recalculando ratingSum/ratingCount depois
      // de uma avaliação — e só quem já importou o prompt (ver /imports abaixo)
      // pode fazer isso, e só esses dois campos podem mudar.
      allow update: if request.auth != null
                    && exists(/databases/$(database)/documents/publicPrompts/$(promptId)/imports/$(request.auth.uid))
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ratingSum', 'ratingCount']);

      // Marca de "essa pessoa já importou este prompt" — é o que libera a avaliação.
      match /imports/{uid} {
        allow get: if request.auth != null && request.auth.uid == uid;
        allow create: if request.auth != null && request.auth.uid == uid;
      }

      // Uma avaliação por pessoa por prompt (o ID do documento é o próprio uid,
      // então reavaliar só atualiza a nota antiga em vez de duplicar).
      match /ratings/{uid} {
        allow get: if request.auth != null && request.auth.uid == uid;
        allow create, update: if request.auth != null && request.auth.uid == uid
                               && exists(/databases/$(database)/documents/publicPrompts/$(promptId)/imports/$(request.auth.uid))
                               && request.resource.data.stars is int
                               && request.resource.data.stars >= 1 && request.resource.data.stars <= 5;
      }
    }

    // Denúncias de prompts impróprios — feature nova. Qualquer pessoa logada pode
    // denunciar; só o dono do projeto lê (pelo Console do Firebase, que ignora
    // essas regras), pra decidir manualmente o que remover.
    match /reports/{reportId} {
      allow create: if request.auth != null && request.resource.data.reportedBy == request.auth.uid;
      allow read, update, delete: if false;
    }

    // Registro de erros do app (monitoramento). Qualquer visitante pode CRIAR um
    // registro (mesmo antes de logar, para pegar erros na própria tela de login),
    // mas ninguém consegue ler, editar ou apagar pelo app — só você, direto pelo
    // Console do Firebase. Limite de tamanho evita abuso/spam.
    match /errorLogs/{logId} {
      allow create: if request.resource.data.message is string
                    && request.resource.data.message.size() < 600
                    && request.resource.data.stack.size() < 1600;
      allow read, update, delete: if false;
    }
  }
}
```

⚠️ **Se você já publicou as regras antes** (numa configuração anterior deste app),
precisa **substituir pelo bloco acima e publicar de novo** — a versão antiga não
tinha permissão de exclusão, e o botão "Excluir minha conta" não vai funcionar
sem isso.

## 6. Criar o contador inicial

1. Ainda em **Firestore Database > Dados**, clique em **"Iniciar coleção"**.
2. ID da coleção: `meta`
3. ID do documento: `stats`
4. Adicione o campo: `userCount` (tipo **number**), valor `0`
5. Salve.

## 7. Ativar o App Check (proteção contra bots no cadastro)

Sem isso, um script automatizado poderia criar várias contas em segundos e
esgotar as 100 vagas gratuitas em poucos segundos. O App Check bloqueia isso
de forma invisível (a pessoa real não percebe nada, não precisa clicar em
nenhum "não sou um robô").

Isso usa duas chaves diferentes — uma pública (site key) e uma secreta —
que vão em lugares diferentes. Siga na ordem:

1. Acesse **https://www.google.com/recaptcha/admin/create**
2. Preencha:
   - **Rótulo:** qualquer nome (ex.: `prompt-facil`)
   - **Tipo de reCAPTCHA:** escolha **reCAPTCHA v3**
   - **Domínios:** adicione o domínio onde o app está publicado (ex.: `promptez.netlify.app`)
3. Aceite os termos e clique em **Enviar**.
4. Você vai receber duas chaves:
   - **Chave do site** (pública) — copie e cole em **`firebase-config.js`**, na linha:
     ```js
     const RECAPTCHA_SITE_KEY = "COLE_SUA_CHAVE_RECAPTCHA_AQUI";
     ```
   - **Chave secreta** — não vai no código do app, guarde para o próximo passo.
5. No **Firebase Console**, procure **Security > App Check** no menu lateral (se não achar, use a busca no topo do console e digite "App Check").
6. Na aba de apps, clique no seu app Web e escolha o provedor **reCAPTCHA v3**.
7. Cole ali a **chave secreta** do passo 4 e salve.
8. Suba o `firebase-config.js` atualizado (com a chave do site) pro Netlify e teste o cadastro normalmente.
9. Só depois de confirmar que o cadastro continua funcionando, volte na tela do App Check e ative a **"Aplicação" (enforcement)** para **Authentication** e **Cloud Firestore**.
   ⚠️ Ative a aplicação só depois de testar — se ativar antes da chave estar correta, o app para de funcionar até corrigir.

## 8. Usar a tela personalizada nos links de email (confirmação/redefinição de senha)

Por padrão, os links que o Firebase manda por email (confirmar email, redefinir
senha) abrem uma página genérica e branca, sem a cara do app. Já criei a versão
personalizada (`acao.html`) — falta só apontar o Firebase pra ela:

1. No **Firebase Console**, vá em **Authentication > Templates** (ou "Modelos", em português).
2. Você vai ver uma lista: "Endereço de email de verificação", "Redefinição de senha", etc.
3. Em cada um desses (pelo menos os dois citados acima), clique no ícone de **lápis (editar)**.
4. Procure a opção **"Personalizar URL de ação"** (customize action URL) — geralmente fica
   como um link clicável perto do rodapé da tela de edição, não é óbvio à primeira vista.
5. Defina como: `https://promptez.netlify.app/acao.html`
6. Salve.

Depois disso, os emails de confirmação e redefinição de senha vão abrir a tela
com o visual do Prompt Fácil, em vez da tela branca padrão do Firebase.

## Pronto!

Depois disso, é só abrir o `index.html` (hospedado em qualquer lugar com HTTPS —
GitHub Pages, Netlify, Vercel etc. funcionam bem e são gratuitos) e testar
criando uma conta.

## Limitações que vale saber

- **O limite de 100 contas é reforçado pelas regras do Firestore** (passo 5),
  não só pelo código do app — então mesmo que alguém tente burlar editando o
  JavaScript, o banco de dados recusa a 101ª conta.
- Em um cenário raríssimo de **duas pessoas se cadastrando no exato mesmo
  instante** quando resta 1 vaga, é possível que uma delas veja a tela
  carregar por um instante antes de receber o aviso de "vagas esgotadas".
  Isso não compromete os dados de ninguém — é só uma questão estética. Se
  no futuro isso importar, dá para reforçar com uma Cloud Function (só que
  aí exige ativar o plano pago "Blaze" do Firebase, mesmo que o uso real
  continue dentro da faixa gratuita).
- Login e sincronização do histórico **exigem internet**. O gerador de
  prompts em si (categoria, descrição, gerar prompt) continua funcionando
  offline depois do primeiro carregamento, graças ao Service Worker.
- Quando quiser abrir para mais gente no futuro, basta subir o número `100`
  nas regras do Firestore (passo 5) e, se o uso crescer muito, migrar do
  plano gratuito "Spark" para o "Blaze" (pago por uso, com uma faixa
  gratuita generosa mesmo assim).
- **Sobre a nota média dos prompts da biblioteca pública:** a soma/contagem
  de avaliações (`ratingSum`/`ratingCount`) é recalculada pelo próprio app,
  numa transação do Firestore — as regras garantem que só quem importou o
  prompt pode mexer nesses campos, e só nesses dois campos, mas não
  recalculam a matemática em si (isso exigiria Cloud Functions, que precisam
  do plano pago). Na prática, pra alguém fraudar a nota teria que editar o
  JavaScript do navegador manualmente, o que é bem mais fricção do que
  qualquer usuário comum vai ter — mas vale saber que não é 100% à prova de
  adulteração deliberada. Se isso virar um problema real (app com bastante
  gente), dá pra mover esse cálculo pra uma Cloud Function no futuro.
