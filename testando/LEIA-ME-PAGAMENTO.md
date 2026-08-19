# Como automatizar a liberação do plano premium (Pix via Asaas)

Este guia coloca no ar as duas Cloud Functions da pasta `functions/`:

- `criarAssinatura`: chamada pelo próprio app quando a pessoa clica em
  "💎 Assinar Premium" — cria a assinatura no Asaas e mostra o QR Code Pix.
- `webhookAsaas`: escuta o aviso do Asaas quando o Pix é pago e troca o
  campo `plano` de `gratis` para `premium` sozinha — é isso que torna o
  processo automático, sem você precisar editar nada no Console.

Antes de começar: **teste tudo isso no ambiente sandbox do Asaas primeiro**
(o código já vem apontando pra lá). Só troque para produção depois de ver o
fluxo inteiro funcionar de ponta a ponta.

## 1. Criar conta no Asaas

1. Crie uma conta em [asaas.com](https://www.asaas.com/).
2. Pra testar sem mexer com dinheiro de verdade, use o ambiente sandbox:
   [sandbox.asaas.com](https://sandbox.asaas.com/) (cadastro separado do
   ambiente de produção).
3. No menu **Integrações > API**, copie sua **Chave de API (API Key)**.
   Isso vira o segredo `ASAAS_API_KEY` no passo 4.
4. Ainda nas configurações, procure **Webhooks** e crie um webhook para
   eventos de **Cobranças (Payments)** — o Asaas pede uma URL (você só terá
   isso depois do passo 5, pode voltar aqui depois) e um **token**. Esse
   token é uma senha que você mesmo inventa (ex.: uma sequência aleatória
   grande) — ela vira o segredo `ASAAS_WEBHOOK_TOKEN`. **Nunca** use a API
   Key como esse token.

## 2. Upgrade do Firebase para o plano Blaze

Cloud Functions só rodam no plano pago (Blaze). O plano Blaze ainda tem uma
faixa gratuita generosa — você só é cobrado se passar dela.

1. No Firebase Console, vá em **Configurações do projeto > Uso e faturamento**.
2. Clique em **Alterar plano** e escolha **Blaze**.
3. Vincule uma conta de faturamento do Google Cloud (cartão de crédito).

## 3. Instalar as ferramentas (uma vez só, no seu computador)

Diferente das regras do Firestore (que você colou direto no Console), Cloud
Functions precisam ser enviadas pelo terminal. Com o [Node.js](https://nodejs.org/)
instalado:

```bash
npm install -g firebase-tools
firebase login
```

Isso abre o navegador pra você entrar com a mesma conta Google do projeto.

## 4. Configurar os segredos (API Key e token do webhook)

Dentro da pasta `prompt-facil` (a raiz do projeto, onde está a pasta
`functions/`), rode:

```bash
firebase use --add
# escolha o projeto "prompt-ez-7" quando ele aparecer na lista

firebase functions:secrets:set ASAAS_API_KEY
# cole a API Key do Asaas quando pedir

firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
# cole o token que você inventou no passo 1.4
```

Esses valores ficam guardados de forma segura no Google Cloud — nunca vão
pro código nem pro GitHub.

## 5. Publicar as functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

No fim, o terminal mostra duas URLs — a que interessa é a de
`webhookAsaas`, algo como:

```
https://southamerica-east1-prompt-ez-7.cloudfunctions.net/webhookAsaas
```

## 6. Terminar de configurar o webhook no Asaas

Volte no painel do Asaas (passo 1.4) e cole essa URL como destino do
webhook. Confirme que o token configurado lá é **exatamente** o mesmo que
você salvou como `ASAAS_WEBHOOK_TOKEN` no passo 4.

## 7. Testar o fluxo inteiro (no sandbox)

1. Abra o app, entre com uma conta de teste (plano grátis).
2. Clique em **💎 Assinar Premium** no menu — deve aparecer um QR Code Pix.
3. No sandbox do Asaas existe um jeito de simular o pagamento de uma
   cobrança sem precisar pagar de verdade (procure por "simular pagamento"
   nas cobranças, dentro do painel sandbox).
4. Depois de simular, o selo no topo do app deve virar **Premium**
   sozinho, sem recarregar a página.

## 8. Indo para produção

Quando tudo estiver testado:

1. Crie/configure a conta de produção do Asaas (KYC, dados bancários etc. —
   o Asaas pede verificação pra mover dinheiro de verdade).
2. Troque `ASAAS_BASE_URL` em `functions/index.js` de
   `https://api-sandbox.asaas.com/v3` para `https://api.asaas.com/v3`.
3. Gere uma **nova** API Key e um **novo** token de webhook de produção
   (são diferentes dos de sandbox) e repita os comandos
   `firebase functions:secrets:set` do passo 4 com os valores novos.
4. Configure o webhook de produção no painel de produção do Asaas com a
   mesma URL do passo 5 (a Cloud Function não muda, só as chaves).
5. Rode `firebase deploy --only functions` de novo.

## Sobre os valores e a régua de planos

O valor da assinatura está fixo em `VALOR_ASSINATURA = 14.9` dentro de
`functions/index.js` — mude ali se quiser outro preço. As regras de quem é
"grátis" e "premium" continuam as mesmas combinadas antes (histórico de
conversa): o gerador básico é livre pra todo mundo, e por enquanto só os
modelos prontos por profissão são travados pro plano grátis.

## Verificação importante

Este código foi escrito com base na documentação pública do Asaas
(docs.asaas.com) — mas APIs de terceiros mudam com o tempo. Antes de ativar
em produção, **confira nos docs atuais do Asaas** se os endpoints usados em
`functions/index.js` (`/customers`, `/subscriptions`, `/payments`,
`/payments/{id}/pixQrCode`) e os nomes dos eventos de webhook
(`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` etc.) continuam os mesmos.
