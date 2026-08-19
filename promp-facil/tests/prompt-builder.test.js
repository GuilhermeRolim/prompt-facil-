// ============================================================
// Testes automatizados da lógica de geração de prompt.
//
// Como rodar:
//   node --test
// (ou, se preferir usar o atalho do package.json: npm test)
//
// Não exige instalar nada — usa o test runner nativo do Node.js
// (disponível a partir do Node 18+; este projeto foi testado no Node 22).
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    depthInstructions,
    buildResearchPrompt,
    buildTechnicalPrompt,
    buildDataAnalysisPrompt,
    buildTranslationPrompt,
    buildImagePrompt
} = require('../prompt-builder.js');

// ---------- depthInstructions ----------

test('depthInstructions tem os três níveis esperados, todos não vazios', () => {
    assert.equal(Object.keys(depthInstructions).length, 3);
    for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
        assert.ok(depthInstructions[nivel], `nível "${nivel}" deveria existir`);
        assert.ok(depthInstructions[nivel].length > 20, `nível "${nivel}" parece vazio/curto demais`);
    }
});

// ---------- buildResearchPrompt ----------

test('buildResearchPrompt inclui a descrição informada', () => {
    const prompt = buildResearchPrompt('mudanças climáticas', '', 'intermediario');
    assert.match(prompt, /mudanças climáticas/);
});

test('buildResearchPrompt inclui o bloco de contexto quando "details" é preenchido', () => {
    const prompt = buildResearchPrompt('assunto X', 'foco em fontes acadêmicas', 'avancado');
    assert.match(prompt, /Contexto e detalhes adicionais fornecidos por mim: foco em fontes acadêmicas\./);
});

test('buildResearchPrompt NÃO inclui bloco de contexto quando "details" está vazio', () => {
    const prompt = buildResearchPrompt('assunto X', '', 'avancado');
    assert.doesNotMatch(prompt, /Contexto e detalhes adicionais fornecidos por mim/);
});

test('buildResearchPrompt aplica a instrução de profundidade correta para cada nível', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
        const prompt = buildResearchPrompt('assunto X', '', nivel);
        assert.ok(
            prompt.includes(depthInstructions[nivel]),
            `prompt deveria conter a instrução de profundidade do nível "${nivel}"`
        );
    }
});

test('buildResearchPrompt mantém a estrutura numerada de 1 a 8', () => {
    const prompt = buildResearchPrompt('assunto X', '', 'iniciante');
    for (let i = 1; i <= 8; i++) {
        assert.match(prompt, new RegExp(`^${i}\\. `, 'm'), `deveria conter o item numerado ${i}`);
    }
});

// ---------- buildTechnicalPrompt ----------

test('buildTechnicalPrompt inclui a linguagem de programação quando informada', () => {
    const prompt = buildTechnicalPrompt('erro no build', '', 'intermediario', 'TypeScript', '', '');
    assert.match(prompt, /especialista em TypeScript/);
});

test('buildTechnicalPrompt NÃO quebra o texto quando a linguagem não é informada', () => {
    const prompt = buildTechnicalPrompt('erro no build', '', 'intermediario', '', '', '');
    assert.match(prompt, /especialista\. Preciso de ajuda/);
    assert.doesNotMatch(prompt, /especialista em \./);
});

test('buildTechnicalPrompt monta o bloco de contexto só com os campos preenchidos', () => {
    const prompt = buildTechnicalPrompt(
        'API lenta',
        'roda em produção há 2 anos',
        'avancado',
        'Python',
        'performance',
        '' // environment vazio de propósito
    );
    assert.match(prompt, /Tipo de problema: performance/);
    assert.match(prompt, /Detalhes adicionais: roda em produção há 2 anos/);
    assert.doesNotMatch(prompt, /Ambiente\/contexto técnico/);
});

test('buildTechnicalPrompt NÃO inclui o bloco de contexto quando todos os campos opcionais estão vazios', () => {
    const prompt = buildTechnicalPrompt('erro genérico', '', 'iniciante', '', '', '');
    assert.doesNotMatch(prompt, /Contexto fornecido por mim/);
});

test('buildTechnicalPrompt aplica a instrução de profundidade correta para cada nível', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
        const prompt = buildTechnicalPrompt('erro X', '', nivel, '', '', '');
        assert.ok(
            prompt.includes(depthInstructions[nivel]),
            `prompt deveria conter a instrução de profundidade do nível "${nivel}"`
        );
    }
});

test('buildTechnicalPrompt preserva aspas e caracteres especiais na descrição sem quebrar', () => {
    const descricaoComAspas = 'erro "TypeError: undefined is not a function" no fetch';
    const prompt = buildTechnicalPrompt(descricaoComAspas, '', 'intermediario', '', '', '');
    assert.match(prompt, /TypeError: undefined is not a function/);
});

test('buildTechnicalPrompt mantém a estrutura numerada de 1 a 7', () => {
    const prompt = buildTechnicalPrompt('erro X', '', 'iniciante', '', '', '');
    for (let i = 1; i <= 7; i++) {
        assert.match(prompt, new RegExp(`^${i}\\. `, 'm'), `deveria conter o item numerado ${i}`);
    }
});

// ---------- buildDataAnalysisPrompt ----------

test('buildDataAnalysisPrompt inclui a descrição informada', () => {
    const prompt = buildDataAnalysisPrompt('vendas caindo no último trimestre', '', 'intermediario', '', '', '');
    assert.match(prompt, /vendas caindo no último trimestre/);
});

test('buildDataAnalysisPrompt monta o bloco de contexto só com os campos preenchidos', () => {
    const prompt = buildDataAnalysisPrompt(
        'churn de clientes',
        'dados de 2 anos',
        'avancado',
        'assinaturas mensais',
        '',
        'reduzir cancelamentos'
    );
    assert.match(prompt, /Tipo de dados: assinaturas mensais/);
    assert.match(prompt, /Objetivo da análise: reduzir cancelamentos/);
    assert.match(prompt, /Detalhes adicionais: dados de 2 anos/);
    assert.doesNotMatch(prompt, /Formato\/ferramenta/);
});

test('buildDataAnalysisPrompt NÃO inclui o bloco de contexto quando todos os campos opcionais estão vazios', () => {
    const prompt = buildDataAnalysisPrompt('assunto X', '', 'iniciante', '', '', '');
    assert.doesNotMatch(prompt, /Contexto fornecido por mim/);
});

test('buildDataAnalysisPrompt aplica a instrução de profundidade correta para cada nível', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
        const prompt = buildDataAnalysisPrompt('assunto X', '', nivel, '', '', '');
        assert.ok(
            prompt.includes(depthInstructions[nivel]),
            `prompt deveria conter a instrução de profundidade do nível "${nivel}"`
        );
    }
});

test('buildDataAnalysisPrompt mantém a estrutura numerada de 1 a 7', () => {
    const prompt = buildDataAnalysisPrompt('assunto X', '', 'iniciante', '', '', '');
    for (let i = 1; i <= 7; i++) {
        assert.match(prompt, new RegExp(`^${i}\\. `, 'm'), `deveria conter o item numerado ${i}`);
    }
});

// ---------- buildTranslationPrompt ----------

test('buildTranslationPrompt inclui a descrição informada', () => {
    const prompt = buildTranslationPrompt('traduzir este contrato', '', '', '', '');
    assert.match(prompt, /traduzir este contrato/);
});

test('buildTranslationPrompt menciona os idiomas quando ambos são informados', () => {
    const prompt = buildTranslationPrompt('texto de marketing', '', 'inglês', 'português', '');
    assert.match(prompt, /especialista em tradução de inglês para português/);
    assert.match(prompt, /Idioma de origem: inglês/);
    assert.match(prompt, /Idioma de destino: português/);
});

test('buildTranslationPrompt NÃO quebra o texto quando nenhum idioma é informado', () => {
    const prompt = buildTranslationPrompt('revisar este e-mail', '', '', '', '');
    assert.match(prompt, /profissional\. Preciso de ajuda/);
});

test('buildTranslationPrompt inclui o tom quando informado', () => {
    const prompt = buildTranslationPrompt('carta para cliente', '', '', 'espanhol', 'formal');
    assert.match(prompt, /Tom\/formalidade desejada: formal/);
});

test('buildTranslationPrompt mantém a estrutura numerada de 1 a 5', () => {
    const prompt = buildTranslationPrompt('assunto X', '', '', '', '');
    for (let i = 1; i <= 5; i++) {
        assert.match(prompt, new RegExp(`^${i}\\. `, 'm'), `deveria conter o item numerado ${i}`);
    }
});

// ---------- buildImagePrompt ----------

test('buildImagePrompt inclui a cena/descrição informada', () => {
    const prompt = buildImagePrompt('um gato astronauta flutuando no espaço', '', '', '', '');
    assert.match(prompt, /Cena principal: um gato astronauta flutuando no espaço\./);
});

test('buildImagePrompt inclui estilo, proporção e elementos a evitar quando informados', () => {
    const prompt = buildImagePrompt('paisagem urbana à noite', '', 'cyberpunk', '16:9', 'texto, marca d\'água');
    assert.match(prompt, /Estilo visual: cyberpunk\./);
    assert.match(prompt, /Proporção\/formato: 16:9\./);
    assert.match(prompt, /Evitar: texto, marca d'água\./);
});

test('buildImagePrompt sugere escolher um estilo quando não informado', () => {
    const prompt = buildImagePrompt('floresta encantada', '', '', '', '');
    assert.match(prompt, /escolha o estilo/);
});

test('buildImagePrompt NÃO usa a estrutura "Aja como" nem instrução de profundidade, por ser voltado a geradores de imagem', () => {
    const prompt = buildImagePrompt('assunto X', '', '', '', '');
    assert.doesNotMatch(prompt, /Aja como/);
});
