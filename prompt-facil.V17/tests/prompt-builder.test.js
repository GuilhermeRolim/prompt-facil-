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
    buildTechnicalPrompt
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
