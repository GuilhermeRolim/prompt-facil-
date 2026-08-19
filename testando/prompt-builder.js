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
        root.buildDataAnalysisPrompt = exportsObj.buildDataAnalysisPrompt;
        root.buildTranslationPrompt = exportsObj.buildTranslationPrompt;
        root.buildImagePrompt = exportsObj.buildImagePrompt;
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

    function buildDataAnalysisPrompt(description, details, depthLevel, dataType, dataFormat, analysisGoal) {
        const lines = [];
        lines.push(`Aja como um analista de dados sênior. Preciso de ajuda para analisar o seguinte: "${description}".`);

        const contextItems = [];
        if (dataType) contextItems.push(`Tipo de dados: ${dataType}`);
        if (dataFormat) contextItems.push(`Formato/ferramenta: ${dataFormat}`);
        if (analysisGoal) contextItems.push(`Objetivo da análise: ${analysisGoal}`);
        if (details) contextItems.push(`Detalhes adicionais: ${details}`);
        if (contextItems.length > 0) {
            lines.push('');
            lines.push('Contexto fornecido por mim:');
            contextItems.forEach(item => lines.push(`- ${item}`));
        }

        lines.push('');
        lines.push('Se faltar alguma informação essencial sobre os dados (ex.: volume, período, colunas disponíveis) para uma boa análise, pergunte antes de assumir e responder.');
        lines.push('');
        lines.push('Estruture sua resposta da seguinte forma:');
        lines.push('1. Entendimento do problema e dos dados disponíveis (ou que tipo de dados seriam necessários, se eu não os tiver descrito em detalhe).');
        lines.push('2. Abordagem e metodologia de análise recomendada, com justificativa.');
        lines.push('3. Passo a passo de como realizar a análise, incluindo fórmulas, consultas (SQL) ou código quando fizer sentido.');
        lines.push('4. Principais métricas e indicadores a observar.');
        lines.push('5. Como interpretar e visualizar os resultados (tipos de gráfico mais adequados).');
        lines.push('6. Possíveis armadilhas, vieses ou limitações dos dados que podem distorcer a análise.');
        lines.push('7. Recomendações práticas e acionáveis com base nos resultados esperados.');
        lines.push('');
        lines.push('Diretrizes gerais para a resposta:');
        lines.push(`- ${depthInstructions[depthLevel]}`);
        lines.push('- Use tabelas, listas e subtítulos para organizar números e comparações.');
        lines.push('- Deixe claro quando uma recomendação depende de uma suposição sobre os dados que não foi confirmada por mim.');
        return lines.join('\n');
    }

    function buildTranslationPrompt(description, details, sourceLanguage, targetLanguage, tone) {
        const lines = [];
        const langPart = (sourceLanguage && targetLanguage)
            ? ` especialista em tradução de ${sourceLanguage} para ${targetLanguage}`
            : (targetLanguage ? ` especialista em tradução para ${targetLanguage}` : '');
        lines.push(`Aja como um tradutor(a) e revisor(a) de texto profissional${langPart}. Preciso de ajuda com o seguinte texto/tarefa: "${description}".`);

        const contextItems = [];
        if (sourceLanguage) contextItems.push(`Idioma de origem: ${sourceLanguage}`);
        if (targetLanguage) contextItems.push(`Idioma de destino: ${targetLanguage}`);
        if (tone) contextItems.push(`Tom/formalidade desejada: ${tone}`);
        if (details) contextItems.push(`Detalhes adicionais: ${details}`);
        if (contextItems.length > 0) {
            lines.push('');
            lines.push('Contexto fornecido por mim:');
            contextItems.forEach(item => lines.push(`- ${item}`));
        }

        lines.push('');
        lines.push('Se faltar alguma informação essencial (por exemplo, o idioma de destino, o público-alvo do texto ou se é tradução livre ou literal), pergunte antes de assumir e responder.');
        lines.push('');
        lines.push('Estruture sua resposta da seguinte forma:');
        lines.push('1. Texto traduzido e/ou revisado na íntegra, preservando o sentido, o tom e a formatação original sempre que possível.');
        lines.push('2. Explicação das principais escolhas de tradução ou adaptação (expressões idiomáticas, termos técnicos, referências culturais).');
        lines.push('3. Erros gramaticais, ortográficos ou de estilo identificados e corrigidos, se aplicável.');
        lines.push('4. Sugestões alternativas para trechos ambíguos ou que possam ser melhorados.');
        lines.push('5. Observações sobre tom, formalidade e adequação ao público-alvo.');
        lines.push('');
        lines.push('Diretrizes gerais para a resposta:');
        lines.push('- Mantenha a naturalidade no idioma de destino, evitando traduções literais que soem artificiais.');
        lines.push('- Sinalize claramente quando um termo não tiver equivalente direto e explique a solução escolhida.');
        lines.push('- Use formatação (negrito, listas) apenas se ajudar a comparar original e tradução.');
        return lines.join('\n');
    }

    function buildImagePrompt(description, details, style, aspectRatio, avoid) {
        const lines = [];
        lines.push('Prompt para geração de imagem:');
        lines.push('');
        lines.push(`Cena principal: ${description}.`);
        if (details) {
            lines.push(`Detalhes adicionais: ${details}.`);
        }
        lines.push(`Estilo visual: ${style ? style : 'escolha o estilo (ex.: fotorrealista, ilustração digital, aquarela, 3D render) que melhor combine com a cena descrita'}.`);
        lines.push('Composição: defina enquadramento, plano (close-up, plano aberto, etc.) e ponto de vista coerentes com a cena.');
        lines.push('Iluminação e atmosfera: escolha uma iluminação (natural, dramática, suave, neon, etc.) que reforce o clima da cena.');
        lines.push('Paleta de cores: defina cores predominantes que combinem com o estilo e a atmosfera descritos.');
        if (aspectRatio) {
            lines.push(`Proporção/formato: ${aspectRatio}.`);
        }
        if (avoid) {
            lines.push(`Evitar: ${avoid}.`);
        }
        lines.push('Qualidade: alta riqueza de detalhes, nítido, sem elementos borrados, distorcidos ou anatomicamente incorretos.');
        lines.push('');
        lines.push('Dica: cole este prompt em geradores de imagem como Midjourney, DALL-E, Gemini ou Stable Diffusion. Alguns aceitam parâmetros extras (ex.: --ar para proporção no Midjourney) que podem ser adicionados manualmente ao final.');
        return lines.join('\n');
    }

    return {
        depthInstructions,
        buildResearchPrompt,
        buildTechnicalPrompt,
        buildDataAnalysisPrompt,
        buildTranslationPrompt,
        buildImagePrompt
    };
});
