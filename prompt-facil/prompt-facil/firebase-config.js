// ============================================================
// CONFIGURAÇÃO DO FIREBASE — PREENCHA COM OS DADOS DO SEU PROJETO
// ============================================================
// Veja o passo a passo completo em LEIA-ME-FIREBASE.md
//
// 1. Acesse https://console.firebase.google.com/
// 2. Crie um projeto novo (gratuito, plano "Spark", sem cartão de crédito)
// 3. Em "Configurações do projeto" > "Geral" > "Seus apps", crie um app da Web
// 4. Copie o objeto de configuração que aparece e cole abaixo, substituindo
//    os valores "COLE_AQUI".
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyCrWT0g6YKDjjj374H2Wt4JAfPyKZ3LMqk",
    authDomain: "prompt-ez-7.firebaseapp.com",
    projectId: "prompt-ez-7",
    storageBucket: "prompt-ez-7.firebasestorage.app",
    messagingSenderId: "265747810956",
    appId: "1:265747810956:web:bc1fd2afa80764504909a9"
};

firebase.initializeApp(firebaseConfig);

// ============================================================
// APP CHECK (proteção contra bots/spam no cadastro e login)
// ============================================================
// Veja o passo a passo em LEIA-ME-FIREBASE.md (seção "App Check").
// Enquanto RECAPTCHA_SITE_KEY não for preenchida, essa proteção fica
// desativada e o app funciona normalmente (sem bloquear nada) — mas
// fica mais vulnerável a scripts automatizados criando contas em massa.
const RECAPTCHA_SITE_KEY = "6LchgEktAAAAAIk-qV4bcKx9oYobkPcsW2xsAanh";

if (RECAPTCHA_SITE_KEY && !RECAPTCHA_SITE_KEY.startsWith('COLE_')) {
    firebase.appCheck().activate(
        new firebase.appCheck.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        true // renova o token automaticamente
    );
} else {
    console.warn('App Check não configurado ainda (RECAPTCHA_SITE_KEY) — veja LEIA-ME-FIREBASE.md.');
}

// Mantém o usuário logado entre sessões (fecha o app e abre de novo sem pedir login de novo)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const auth = firebase.auth();
const db = firebase.firestore();

// Deixa o Firestore utilizável offline (cache local), para o app não quebrar
// totalmente sem internet — mas login/cadastro e sincronização em si exigem rede.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('Persistência offline do Firestore não pôde ser ativada:', err.code);
});
