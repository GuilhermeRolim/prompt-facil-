// ============================================================
// Lógica pura de montagem dos prompts (sem nenhum acesso a DOM).
// Extraída de app.js para poder ser testada automaticamente
// (veja tests/prompt-builder.test.js) sem precisar de navegador.
//
// Funciona nos dois mundos:
//  - No navegador: this arquivo é carregado via <script defer> ANTES do
//    app.js, então `buildResearchPrompt`, `buildTechnicalPrompt` e
//    `depthInstructions` continuam disponíveis como funções/objeto
//    globais, exatamente como estavam antes — nada muda para o app.js.
//  - No Node.js (testes): `require('./prompt-builder.js')` devolve as
//    mesmas três coisas via module.exports.
// ============================================================
(function (root, factory) {
    const exportsObj = factory();
    if (typeof module === 'object' && typeof module.exports === 'object') {
        // Node.js / CommonJS (usado pelos testes)
        module.exports = exportsObj;
    }
    if (root) {
        // Navegador: expõe como globais, igual ao comportamento original
        root.depthInstructions = exportsObj.depthInstructions;
        root.buildResearchPrompt = exportsObj.buildResearchPrompt;
        root.buildTechnicalPrompt = exportsObj.buildTechnicalPrompt;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {

    // Instruções de profundidade, aplicadas a ambas as categorias
    const depthInstructions = {
        iniciante: 'Explique como se eu não tivesse nenhum conhecimento prévio sobre o assunto: evite jargões (ou defina-os quando forem inevitáveis) e priorize clareza sobre completude técnica.',
        intermediario: 'Assuma que eu já tenho uma noção básica do tema: pode usar terminologia técnica, mas explique os conceitos mais avançados ou menos óbvios sempre que aparecerem.',
        avancado: 'Assuma que eu tenho conhecimento avançado do assunto: pode ser tecnicamente denso, aprofunde-se em nuances, exceções e detalhes especializados sem precisar simplificar.'
    };

    function buildResearchPrompt(description, details, depthLevel) {
        const lines = [];
        lines.push(`Aja como um pesquisador experiente e especialista no seguinte assunto: "${description}".`);
        if (details) {
            lines.push(`Contexto e detalhes adicionais fornecidos por mim: ${details}.`);
        }
        lines.push('');
        lines.push('Antes de responder, se algo na minha solicitação estiver ambíguo ou faltar contexto essencial para uma boa pesquisa, faça as perguntas necessárias antes de prosseguir.');
        lines.push('');
        lines.push('Estruture sua resposta da seguinte forma:');
        lines.push('1. Visão geral e contexto do tema.');
        lines.push('2. Principais conceitos e definições relevantes.');
        lines.push('3. Dados, estatísticas ou informações mais recentes disponíveis, indicando a data/período de referência.');
        lines.push('4. Diferentes perspectivas, correntes de pensamento ou controvérsias existentes sobre o tema, quando houver.');
        lines.push('5. Exemplos práticos, estudos de caso ou aplicações reais.');
        lines.push('6. Vantagens, desvantagens, riscos e limitações relacionados ao tema.');
        lines.push('7. Tendências recentes ou desenvolvimentos futuros esperados.');
        lines.push('8. Conclusão com os principais aprendizados e recomendações práticas e acionáveis.');
        lines.push('');
        lines.push('Diretrizes gerais para a resposta:');
        lines.push('- Cite fontes confiáveis (órgãos oficiais, veículos de imprensa reconhecidos, estudos acadêmicos) sempre que possível, e indique quando uma informação for uma estimativa ou opinião.');
        lines.push('- Priorize informações atualizadas; se não tiver certeza sobre a atualidade de um dado, sinalize isso.');
        lines.push('- Use listas, subtítulos e parágrafos curtos para facilitar a leitura.');
        lines.push(`- ${depthInstructions[depthLevel]}`);
        lines.push('- Evite generalizações vagas: seja específico e concreto sempre que possível.');
        return lines.join('\n');
    }

    function buildTechnicalPrompt(description, details, depthLevel, programmingLanguage, problemType, environment) {
        const lines = [];
        const langPart = programmingLanguage ? ` em ${programmingLanguage}` : '';
        lines.push(`Aja como um engenheiro(a) de software sênior especialista${langPart}. Preciso de ajuda com o seguinte problema: "${description}".`);

        const contextItems = [];
        if (problemType) contextItems.push(`Tipo de problema: ${problemType}`);
        if (environment) contextItems.push(`Ambiente/contexto técnico: ${environment}`);
        if (details) contextItems.push(`Detalhes adicionais: ${details}`);
        if (contextItems.length > 0) {
            lines.push('');
            lines.push('Contexto fornecido por mim:');
            contextItems.forEach(item => lines.push(`- ${item}`));
        }

        lines.push('');
        lines.push('Se faltar alguma informação essencial (por exemplo, versão da linguagem/framework, dependências, ou comportamento esperado x atual), pergunte antes de assumir e responder.');
        lines.push('');
        lines.push('Estruture sua resposta da seguinte forma:');
        lines.push('1. Diagnóstico: explique a causa raiz do problema (ou os requisitos, se for uma implementação nova) antes de propor a solução.');
        lines.push('2. Solução passo a passo, com código completo, comentado e pronto para uso (evite trechos truncados ou "...").');
        lines.push('3. Explicação das decisões técnicas tomadas, incluindo alternativas possíveis e seus trade-offs (performance, legibilidade, manutenibilidade, escalabilidade).');
        lines.push('4. Tratamento de erros, validações e casos extremos (edge cases) relevantes.');
        lines.push('5. Sugestões de testes (unitários, de integração ou manuais) para validar a solução.');
        lines.push('6. Boas práticas, padrões de projeto e ferramentas recomendadas para esse contexto.');
        lines.push('7. Caso existam múltiplas abordagens possíveis, compare-as e recomende a mais adequada, justificando a escolha.');
        lines.push('');
        lines.push('Diretrizes gerais para a resposta:');
        lines.push(`- ${depthInstructions[depthLevel]}`);
        lines.push('- Use formatação de código (blocos de código) e organize a resposta com subtítulos.');
        lines.push('- Se possível, aponte links de documentação oficial relevante.');
        return lines.join('\n');
    }

    return { depthInstructions, buildResearchPrompt, buildTechnicalPrompt };
});
