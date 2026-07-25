// ============================================================
// Cloud Functions do Prompt Fácil — assinatura mensal via Pix (Asaas)
// ============================================================
// Duas funções:
//
// 1. criarAssinatura (callable, chamada pelo app quando a pessoa clica em
//    "Assinar Premium"): cria o cliente e a assinatura no Asaas e devolve
//    o QR Code Pix da primeira cobrança.
//
// 2. webhookAsaas (HTTP público, configurado no painel do Asaas): recebe o
//    aviso de pagamento confirmado/atrasado/cancelado e grava o campo
//    "plano" do usuário no Firestore — é isso que torna a liberação
//    automática, sem ninguém precisar mexer no Console manualmente.
//
// IMPORTANTE: os nomes de endpoint/campos abaixo seguem a documentação
// pública do Asaas (docs.asaas.com) no momento em que este código foi
// escrito. APIs de terceiros mudam — antes de colocar em produção, confira
// se os endpoints usados aqui (/customers, /subscriptions, /payments,
// /payments/{id}/pixQrCode) ainda batem com a documentação atual do Asaas,
// e teste tudo no ambiente sandbox deles primeiro.
// ============================================================

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// São Paulo — deixa as funções mais rápidas pra quem usa o app no Brasil.
setGlobalOptions({ region: 'southamerica-east1' });

// Segredos: configurados via `firebase functions:secrets:set NOME`
// (veja o passo a passo em LEIA-ME-PAGAMENTO.md). Nunca ficam no código.
const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY');
const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');

// Troque para 'https://api.asaas.com/v3' só quando for para produção de
// verdade — enquanto estiver testando, use o sandbox:
// 'https://api-sandbox.asaas.com/v3'
const ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3';

const VALOR_ASSINATURA = 14.9;

async function asaasFetch(path, options, apiKey) {
  const resposta = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(options && options.headers),
    },
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    logger.error('Erro na API do Asaas', { path, dados });
    const mensagem = (dados && dados.errors && dados.errors[0] && dados.errors[0].description)
      || 'Não foi possível falar com o Asaas.';
    throw new Error(mensagem);
  }
  return dados;
}

// ------------------------------------------------------------
// 1. criarAssinatura
// ------------------------------------------------------------
exports.criarAssinatura = onCall({ secrets: [ASAAS_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar logado para assinar.');
  }

  const uid = request.auth.uid;
  const apiKey = ASAAS_API_KEY.value();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Perfil não encontrado.');
  }
  const userData = userSnap.data();

  if (userData.plano === 'premium') {
    throw new HttpsError('already-exists', 'Essa conta já é premium.');
  }

  try {
    // Garante um cliente no Asaas (cria uma vez só; reaproveita nas próximas tentativas)
    let asaasCustomerId = userData.asaasCustomerId;
    if (!asaasCustomerId) {
      const cliente = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: userData.name || 'Cliente Prompt Fácil',
          email: userData.email || request.auth.token.email,
          externalReference: uid, // é isso que o webhook usa pra saber de quem é o pagamento
        }),
      }, apiKey);
      asaasCustomerId = cliente.id;
      await userRef.set({ asaasCustomerId }, { merge: true });
    }

    // Cria a assinatura mensal via Pix
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const assinatura = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'PIX',
        cycle: 'MONTHLY',
        value: VALOR_ASSINATURA,
        nextDueDate: amanha,
        description: 'Assinatura Prompt Fácil Premium',
        externalReference: uid,
      }),
    }, apiKey);
    await userRef.set({ asaasSubscriptionId: assinatura.id }, { merge: true });

    // Busca a primeira cobrança gerada automaticamente pela assinatura
    const cobrancas = await asaasFetch(`/payments?subscription=${assinatura.id}`, { method: 'GET' }, apiKey);
    const primeiraCobranca = cobrancas.data && cobrancas.data[0];
    if (!primeiraCobranca) {
      throw new HttpsError('internal', 'Assinatura criada, mas a cobrança ainda não apareceu. Tente de novo em alguns segundos.');
    }

    // Pega o QR Code Pix dessa cobrança
    const qrCode = await asaasFetch(`/payments/${primeiraCobranca.id}/pixQrCode`, { method: 'GET' }, apiKey);

    return {
      encodedImage: qrCode.encodedImage,   // imagem do QR Code em base64
      payload: qrCode.payload,             // código "copia e cola"
      expirationDate: qrCode.expirationDate,
    };
  } catch (err) {
    logger.error('Falha ao criar assinatura', { uid, error: err.message });
    throw new HttpsError('internal', err.message || 'Não foi possível criar a assinatura agora.');
  }
});

// ------------------------------------------------------------
// 2. webhookAsaas
// ------------------------------------------------------------
// O Asaas não avisa diretamente sobre mudanças de assinatura — ele avisa
// sobre mudanças em COBRANÇAS (payments). Por isso escutamos os eventos de
// pagamento, não os de assinatura.
const EVENTOS_QUE_LIBERAM = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
const EVENTOS_QUE_BLOQUEIAM = ['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED'];

exports.webhookAsaas = onRequest({ secrets: [ASAAS_WEBHOOK_TOKEN] }, async (req, res) => {
  // Confere o token configurado no painel do Asaas (Configurações > Webhooks).
  // NUNCA use a API Key aqui — é um token separado, só pra isso.
  const tokenRecebido = req.get('asaas-access-token');
  if (!tokenRecebido || tokenRecebido !== ASAAS_WEBHOOK_TOKEN.value()) {
    logger.warn('Webhook do Asaas recebido com token inválido — ignorado.');
    res.status(401).send('token inválido');
    return;
  }

  const evento = req.body || {};
  const tipo = evento.event;
  const payment = evento.payment;

  if (!tipo || !payment) {
    res.status(200).send('ignorado: payload sem "payment"');
    return;
  }

  const uid = payment.externalReference;
  if (!uid) {
    logger.warn('Webhook sem externalReference — não dá pra saber de quem é.', { paymentId: payment.id });
    res.status(200).send('ignorado: sem externalReference');
    return;
  }

  try {
    const userRef = db.collection('users').doc(uid);
    if (EVENTOS_QUE_LIBERAM.includes(tipo)) {
      await userRef.set({
        plano: 'premium',
        ultimoPagamentoConfirmadoEm: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      logger.info('Plano liberado automaticamente', { uid, tipo });
    } else if (EVENTOS_QUE_BLOQUEIAM.includes(tipo)) {
      await userRef.set({ plano: 'gratis' }, { merge: true });
      logger.info('Plano revogado automaticamente', { uid, tipo });
    }
    // Outros tipos de evento (ex.: PAYMENT_CREATED, PAYMENT_UPDATED) são
    // apenas confirmados com 200 e ignorados — não mudam o plano.
    res.status(200).send('ok');
  } catch (err) {
    logger.error('Erro ao processar webhook do Asaas', { uid, error: err.message });
    // Devolve 500 de propósito: o Asaas tenta reentregar o evento depois.
    res.status(500).send('erro interno');
  }
});
