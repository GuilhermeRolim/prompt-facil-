        // ---------- Modo claro / escuro ----------
        // O tema salvo já é aplicado antes do paint por um script inline no <head>
        // (evita o "flash" do tema errado). Aqui só cuidamos da troca em tempo real.
        const THEME_KEY = 'promptFacil.theme';

        function applyTheme(theme) {
            if (theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }

        function getCurrentTheme() {
            return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        }

        function toggleTheme() {
            const next = getCurrentTheme() === 'light' ? 'dark' : 'light';
            applyTheme(next);
            const switchBtn = document.getElementById('themeToggleApp');
            if (switchBtn) switchBtn.setAttribute('aria-checked', String(next === 'light'));
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (e) {
                // localStorage indisponível (modo privado/restrições) — o tema ainda
                // funciona nesta sessão, só não é lembrado na próxima visita.
            }
        }

        // ---------- Menu único do topo (feature nova) ----------
        // Consolida Histórico/Favoritos/Links/Biblioteca/Sair num só dropdown,
        // em vez de vários botões soltos. Cada item mantém seu próprio listener
        // de clique (registrado mais abaixo, junto de cada feature) — aqui só
        // cuidamos de abrir/fechar o menu em si.
        function openAppMenu() {
            document.getElementById('appMenuDropdown').classList.add('show');
            document.getElementById('appMenuTrigger').classList.add('is-open');
            document.getElementById('appMenuTrigger').setAttribute('aria-expanded', 'true');
        }

        function closeAppMenu() {
            document.getElementById('appMenuDropdown').classList.remove('show');
            document.getElementById('appMenuTrigger').classList.remove('is-open');
            document.getElementById('appMenuTrigger').setAttribute('aria-expanded', 'false');
        }

        document.getElementById('appMenuTrigger').addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = document.getElementById('appMenuDropdown').classList.contains('show');
            if (isOpen) {
                closeAppMenu();
            } else {
                openAppMenu();
            }
        });
        // Clicar em qualquer lugar fora (inclusive em um item do menu, depois da
        // ação dele já ter disparado) fecha o dropdown.
        document.addEventListener('click', closeAppMenu);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAppMenu();
        });

        // ---------- Monitoramento de erros (visibilidade em produção, sem ferramenta paga) ----------
        // Registra erros que acontecem no navegador de quem está usando o app, direto numa
        // coleção do Firestore (errorLogs). Só escreve — ninguém consegue ler pelo app, só você,
        // direto no Console do Firebase (Firestore Database > errorLogs).
        function logClientError(error, context) {
            try {
                const message = (error && error.message) ? String(error.message) : String(error);
                const stack = (error && error.stack) ? String(error.stack) : '';
                if (typeof db === 'undefined') return; // firebase-config.js não carregou ainda/falhou

                db.collection('errorLogs').add({
                    message: (context ? `[${context}] ` : '') + message.slice(0, 500),
                    stack: stack.slice(0, 1500),
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    uid: (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : 'anon',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {}); // se até o log falhar (ex: offline), ignora silenciosamente
            } catch (e) {
                // O monitoramento de erros nunca pode, ele mesmo, quebrar o app.
            }
        }
        window.addEventListener('error', (event) => {
            logClientError(event.error || event.message, 'erro não tratado');
        });
        window.addEventListener('unhandledrejection', (event) => {
            logClientError(event.reason, 'promise rejeitada');
        });

        // ---------- Menu de seleção personalizado (substitui o visual nativo do <select>) ----------
        const customSelectRegistry = {}; // guarda trigger/dropdown/wrapper de cada select por id

        function positionDropdown(trigger, dropdown) {
            const rect = trigger.getBoundingClientRect();
            const margin = 6;
            const naturalHeight = dropdown.getBoundingClientRect().height || 240;
            const spaceBelow = window.innerHeight - rect.bottom - margin;
            const spaceAbove = rect.top - margin;

            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';

            // Se não houver espaço suficiente abaixo (e houver mais espaço acima),
            // o menu abre para cima em vez de ser cortado pela borda da tela.
            if (spaceBelow < naturalHeight && spaceAbove > spaceBelow) {
                dropdown.style.top = 'auto';
                dropdown.style.bottom = (window.innerHeight - rect.top + margin) + 'px';
                dropdown.style.maxHeight = Math.min(240, spaceAbove) + 'px';
            } else {
                dropdown.style.bottom = 'auto';
                dropdown.style.top = (rect.bottom + margin) + 'px';
                dropdown.style.maxHeight = Math.min(240, spaceBelow) + 'px';
            }
        }

        function buildCustomSelect(nativeSelect) {
            if (!nativeSelect || nativeSelect.dataset.customized) return;
            nativeSelect.dataset.customized = 'true';

            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select' + (nativeSelect.disabled ? ' disabled' : '');

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'custom-select-trigger';

            // A lista de opções fica solta no <body>, flutuando por cima de tudo,
            // para nunca ser cortada por cantos arredondados de caixas com overflow escondido.
            const dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wrapper.classList.contains('disabled')) return;
                const isOpen = dropdown.classList.contains('open');
                closeAllCustomSelects();
                if (!isOpen) {
                    positionDropdown(trigger, dropdown);
                    dropdown.classList.add('open');
                    wrapper.classList.add('open');
                }
            });

            wrapper.appendChild(trigger);
            nativeSelect.insertAdjacentElement('afterend', wrapper);
            document.body.appendChild(dropdown);

            customSelectRegistry[nativeSelect.id] = { nativeSelect, wrapper, trigger, dropdown };
            rebuildCustomSelectOptions(nativeSelect.id);

            // Faz o rótulo (label) associado também abrir o menu personalizado ao ser clicado
            const associatedLabel = document.querySelector(`label[for="${nativeSelect.id}"]`);
            if (associatedLabel) {
                associatedLabel.style.cursor = 'pointer';
                associatedLabel.addEventListener('click', () => trigger.click());
            }
        }

        // Reconstrói as opções do menu personalizado a partir do <select> nativo —
        // usada tanto na montagem inicial quanto sempre que as opções do <select>
        // mudam dinamicamente via JS (ex.: lista de "Modelo" dos templates por profissão).
        function rebuildCustomSelectOptions(id) {
            const entry = customSelectRegistry[id];
            if (!entry) return;
            const { nativeSelect, trigger, dropdown } = entry;

            dropdown.innerHTML = '';
            Array.from(nativeSelect.options).forEach((opt) => {
                const item = document.createElement('div');
                item.className = 'custom-select-option'
                    + (opt.value === '' ? ' placeholder-option' : '')
                    + (opt.selected ? ' selected' : '');
                item.textContent = opt.textContent;
                item.dataset.value = opt.value;
                item.addEventListener('click', () => {
                    nativeSelect.value = opt.value;
                    dropdown.querySelectorAll('.custom-select-option').forEach((o) => o.classList.remove('selected'));
                    item.classList.add('selected');
                    trigger.textContent = opt.textContent;
                    trigger.classList.toggle('is-placeholder', opt.value === '');
                    closeAllCustomSelects();
                    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                });
                dropdown.appendChild(item);
            });

            const initialOption = nativeSelect.options[nativeSelect.selectedIndex];
            trigger.textContent = initialOption ? initialOption.textContent : '';
            trigger.classList.toggle('is-placeholder', !initialOption || initialOption.value === '');
        }

        function closeAllCustomSelects() {
            Object.values(customSelectRegistry).forEach(({ wrapper, dropdown }) => {
                wrapper.classList.remove('open');
                dropdown.classList.remove('open');
            });
        }
        document.addEventListener('click', closeAllCustomSelects);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllCustomSelects();
        });
        // Fecha (em vez de deixar torto) se a PÁGINA rolar ou a janela for redimensionada —
        // mas não quando a rolagem acontece dentro do próprio menu aberto (senão ele
        // fecharia assim que a pessoa tentasse rolar a lista de opções).
        window.addEventListener('scroll', (e) => {
            const scrollingInsideDropdown = Object.values(customSelectRegistry)
                .some(({ dropdown }) => dropdown.contains(e.target));
            if (scrollingInsideDropdown) return;
            closeAllCustomSelects();
        }, true);
        window.addEventListener('resize', closeAllCustomSelects);

        // Atualiza o texto exibido no menu personalizado quando o valor do select é alterado via código
        function refreshCustomSelect(id) {
            const entry = customSelectRegistry[id];
            if (!entry) return;
            const { nativeSelect, trigger, dropdown } = entry;
            const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];
            trigger.textContent = selectedOption ? selectedOption.textContent : '';
            trigger.classList.toggle('is-placeholder', !selectedOption || selectedOption.value === '');
            dropdown.querySelectorAll('.custom-select-option').forEach((o) => {
                o.classList.toggle('selected', o.dataset.value === nativeSelect.value);
            });
        }

        // Habilita/desabilita tanto o select nativo quanto o menu personalizado
        function setCustomSelectDisabled(id, disabled) {
            const entry = customSelectRegistry[id];
            if (!entry) return;
            entry.nativeSelect.disabled = disabled;
            entry.wrapper.classList.toggle('disabled', disabled);
        }

        buildCustomSelect(document.getElementById('category'));
        buildCustomSelect(document.getElementById('depthLevel'));
        buildCustomSelect(document.getElementById('aiTarget'));

        // ---------- Templates por profissão (feature nova) ----------
        // Cada profissão tem alguns modelos prontos: escolher um pré-preenche
        // categoria, descrição, detalhes (e campos técnicos, quando for o caso).
        // Os textos entre [colchetes] são pra pessoa substituir pelo caso dela.
        const PROFESSION_TEMPLATES = [
            {
                id: 'advogado',
                label: 'Advogado(a) / Jurídico',
                templates: [
                    {
                        label: 'Resumir lei ou jurisprudência',
                        category: 'pesquisa',
                        description: 'Resumir e explicar de forma clara [nome da lei, artigo ou jurisprudência]',
                        details: 'Foque nos pontos que mais impactam a prática, exemplos de aplicação no dia a dia e possíveis controvérsias de interpretação entre tribunais',
                        depthLevel: 'avancado'
                    },
                    {
                        label: 'Estrutura de peça processual',
                        category: 'pesquisa',
                        description: 'Montar a estrutura de uma [tipo de peça: petição inicial, contestação, recurso, etc.] sobre [descreva o caso em poucas linhas]',
                        details: 'Considere fundamentos legais aplicáveis, jurisprudência recente sobre o tema e os argumentos de defesa/ataque mais fortes disponíveis',
                        depthLevel: 'avancado'
                    },
                    {
                        label: 'Explicar cláusula contratual',
                        category: 'pesquisa',
                        description: 'Explicar em linguagem simples o que significa esta cláusula contratual: "[cole aqui o texto da cláusula]"',
                        details: 'Aponte riscos para quem assina, ambiguidades no texto e o que costuma ser negociado nesse tipo de cláusula',
                        depthLevel: 'intermediario'
                    }
                ]
            },
            {
                id: 'programador',
                label: 'Programador(a) / Dev',
                templates: [
                    {
                        label: 'Corrigir um bug',
                        category: 'tecnico',
                        description: 'Corrigir o seguinte bug: [descreva o comportamento esperado x o que está acontecendo]',
                        details: 'Cole o trecho de código relevante e a mensagem de erro completa, se houver',
                        problemType: 'Bug',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Revisar e otimizar código',
                        category: 'tecnico',
                        description: 'Revisar o seguinte trecho de código em busca de bugs, más práticas e oportunidades de otimização: [cole o código aqui]',
                        details: 'Priorize legibilidade e performance, e explique o motivo de cada mudança sugerida',
                        problemType: 'Otimização / revisão de código',
                        depthLevel: 'avancado'
                    },
                    {
                        label: 'Planejar arquitetura de uma feature nova',
                        category: 'tecnico',
                        description: 'Planejar a arquitetura para implementar: [descreva a feature/funcionalidade nova]',
                        details: 'Considere escalabilidade, manutenção a longo prazo e integração com o que já existe no projeto',
                        problemType: 'Implementação / arquitetura',
                        depthLevel: 'avancado'
                    }
                ]
            },
            {
                id: 'marketing',
                label: 'Marketing / Social Media',
                templates: [
                    {
                        label: 'Calendário de conteúdo',
                        category: 'pesquisa',
                        description: 'Criar um calendário de conteúdo para [rede social] de um negócio de [nicho/segmento] durante [período, ex.: 30 dias]',
                        details: 'Inclua variedade de formatos (posts, stories, reels), temas de cada semana e sugestões de call-to-action',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Copy para campanha/anúncio',
                        category: 'pesquisa',
                        description: 'Escrever textos (copy) para uma campanha de anúncio de [produto/serviço], voltada para [público-alvo]',
                        details: 'Foque no problema que o público enfrenta, no benefício principal da oferta e em um CTA (chamada para ação) direto',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Analisar concorrência',
                        category: 'pesquisa',
                        description: 'Analisar a estratégia de marketing digital dos principais concorrentes de [nome do negócio/segmento]',
                        details: 'Considere posicionamento, tom de voz, tipos de conteúdo que mais engajam e possíveis lacunas a explorar',
                        depthLevel: 'avancado'
                    }
                ]
            },
            {
                id: 'professor',
                label: 'Professor(a) / Educador(a)',
                templates: [
                    {
                        label: 'Plano de aula',
                        category: 'pesquisa',
                        description: 'Criar um plano de aula sobre [tema] para alunos de [série/nível/idade]',
                        details: 'Inclua objetivos de aprendizagem, atividades práticas e uma forma simples de avaliar se o conteúdo foi compreendido',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Simplificar conteúdo didático',
                        category: 'pesquisa',
                        description: 'Explicar de forma simples e com analogias o conceito de [tema/conceito], para alunos de [série/nível]',
                        details: 'Evite jargões técnicos e use exemplos do cotidiano dos alunos sempre que possível',
                        depthLevel: 'iniciante'
                    },
                    {
                        label: 'Banco de questões/avaliação',
                        category: 'pesquisa',
                        description: 'Criar [quantidade] questões sobre [tema], no formato [múltipla escolha/dissertativa], para uma avaliação de [série/nível]',
                        details: 'Inclua o gabarito com uma breve justificativa de cada resposta correta',
                        depthLevel: 'intermediario'
                    }
                ]
            },
            {
                id: 'designer',
                label: 'Designer (UX/UI/Gráfico)',
                templates: [
                    {
                        label: 'Briefing de identidade visual',
                        category: 'pesquisa',
                        description: 'Montar um briefing de identidade visual para uma marca de [segmento/nicho], com posicionamento [descreva em poucas palavras]',
                        details: 'Inclua sugestões de paleta de cores, tipografia e referências visuais que combinem com o posicionamento',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Revisão de usabilidade (heurísticas)',
                        category: 'pesquisa',
                        description: 'Avaliar a usabilidade da seguinte tela/fluxo com base nas heurísticas de Nielsen: [descreva a tela ou cole o fluxo]',
                        details: 'Aponte problemas encontrados, o nível de severidade de cada um e sugestões práticas de melhoria',
                        depthLevel: 'avancado'
                    },
                    {
                        label: 'Moodboard / direção de estilo',
                        category: 'pesquisa',
                        description: 'Sugerir uma direção de estilo visual (moodboard) para [tipo de projeto: app, site, embalagem, etc.] com a sensação de [ex.: minimalista, divertido, premium]',
                        details: 'Descreva paleta de cores, tipografia, texturas e referências que ajudem a transmitir essa sensação',
                        depthLevel: 'intermediario'
                    }
                ]
            },
            {
                id: 'empreendedor',
                label: 'Empreendedor(a) / Pequeno Negócio',
                templates: [
                    {
                        label: 'Plano de negócios simplificado',
                        category: 'pesquisa',
                        description: 'Montar um plano de negócios simplificado para [ideia de negócio]',
                        details: 'Inclua público-alvo, proposta de valor, principais concorrentes, modelo de receita e primeiros passos para validar a ideia',
                        depthLevel: 'intermediario'
                    },
                    {
                        label: 'Análise de viabilidade de ideia',
                        category: 'pesquisa',
                        description: 'Analisar a viabilidade da seguinte ideia de negócio: [descreva a ideia]',
                        details: 'Considere tamanho de mercado, barreiras de entrada, custos iniciais estimados e principais riscos',
                        depthLevel: 'avancado'
                    },
                    {
                        label: 'Roteiro de pitch/apresentação',
                        category: 'pesquisa',
                        description: 'Criar um roteiro de pitch de [duração, ex.: 3 minutos] para apresentar [ideia/negócio] a [investidores/banco/parceiros]',
                        details: 'Estruture com problema, solução, diferencial competitivo e um pedido claro no final',
                        depthLevel: 'intermediario'
                    }
                ]
            }
        ];

        function populateProfessionSelect() {
            const select = document.getElementById('professionSelect');
            PROFESSION_TEMPLATES.forEach((profession) => {
                const opt = document.createElement('option');
                opt.value = profession.id;
                opt.textContent = profession.label;
                select.appendChild(opt);
            });
        }
        populateProfessionSelect();

        buildCustomSelect(document.getElementById('professionSelect'));
        buildCustomSelect(document.getElementById('templateSelect'));
        setCustomSelectDisabled('templateSelect', true);

        // Troca a profissão: repopula a lista de modelos (ou esconde, se "Nenhum")
        function updateTemplateOptions() {
            const professionId = document.getElementById('professionSelect').value;
            const wrapper = document.getElementById('templateOptionWrapper');
            const templateSelect = document.getElementById('templateSelect');

            templateSelect.innerHTML = '<option value="">Selecione um modelo</option>';
            const profession = PROFESSION_TEMPLATES.find((p) => p.id === professionId);

            if (!profession) {
                wrapper.style.display = 'none';
                rebuildCustomSelectOptions('templateSelect');
                setCustomSelectDisabled('templateSelect', true);
                return;
            }

            profession.templates.forEach((tpl, index) => {
                const opt = document.createElement('option');
                opt.value = String(index);
                opt.textContent = tpl.label;
                templateSelect.appendChild(opt);
            });

            wrapper.style.display = 'block';
            rebuildCustomSelectOptions('templateSelect');
            setCustomSelectDisabled('templateSelect', false);
        }

        // Aplica o modelo escolhido nos campos do formulário
        function handleTemplateSelected() {
            const professionId = document.getElementById('professionSelect').value;
            const templateIndex = document.getElementById('templateSelect').value;
            const profession = PROFESSION_TEMPLATES.find((p) => p.id === professionId);
            if (!profession || templateIndex === '') return;
            const tpl = profession.templates[Number(templateIndex)];
            if (!tpl) return;

            document.getElementById('category').value = tpl.category;
            refreshCustomSelect('category');
            updateDynamicFields();

            document.getElementById('description').value = tpl.description || '';
            document.getElementById('details').value = tpl.details || '';

            if (tpl.depthLevel) {
                document.getElementById('depthLevel').value = tpl.depthLevel;
                refreshCustomSelect('depthLevel');
            }

            if (tpl.category === 'tecnico') {
                document.getElementById('programmingLanguage').value = tpl.programmingLanguage || '';
                document.getElementById('problemType').value = tpl.problemType || '';
                document.getElementById('environment').value = tpl.environment || '';
            }

            checkDescription();
            const descriptionField = document.getElementById('description');
            descriptionField.focus();
            descriptionField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Prompt editável: cresce junto com o conteúdo (até o limite definido em CSS,
        // onde passa a rolar). Chamada tanto ao digitar quanto sempre que o valor é
        // trocado via JS (gerar prompt, restaurar do histórico).
        function autoGrowPromptText() {
            const el = document.getElementById('promptText');
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';

            // Se a pessoa apagar o prompt manualmente, os controles de "abrir na IA",
            // "favoritar" e "compartilhar" voltam a ficar desabilitados — evita agir sobre um prompt vazio.
            if (!el.value.trim()) {
                setCustomSelectDisabled('aiTarget', true);
                document.getElementById('openAiButton').disabled = true;
                document.getElementById('favoritePromptButton').disabled = true;
                document.getElementById('sharePromptButton').disabled = true;
            }
        }
        document.getElementById('promptText').addEventListener('input', autoGrowPromptText);

        // Função para verificar e habilitar/desabilitar os botões com base no conteúdo da descrição
        function checkDescription() {
            const description = document.getElementById('description').value.trim();
            const hasContent = description !== '';
            document.getElementById('generateButton').disabled = !hasContent;
        }

        // Adiciona event listener ao textarea para verificar em tempo real
        document.getElementById('description').addEventListener('input', checkDescription);

        // Chamada inicial para definir o estado dos botões no carregamento da página
        checkDescription();

        // Função para mostrar/ocultar campos dinâmicos com base na categoria
        function updateDynamicFields() {
            const category = document.getElementById('category').value;
            // Esconde todos os blocos de campos dinâmicos por categoria
            document.getElementById('techFields').style.display = 'none';
            document.getElementById('dataFields').style.display = 'none';
            document.getElementById('translationFields').style.display = 'none';
            document.getElementById('imageFields').style.display = 'none';

            if (category === 'tecnico') {
                document.getElementById('techFields').style.display = 'block';
            } else if (category === 'dados') {
                document.getElementById('dataFields').style.display = 'block';
            } else if (category === 'traducao') {
                document.getElementById('translationFields').style.display = 'block';
            } else if (category === 'imagem') {
                document.getElementById('imageFields').style.display = 'block';
            }

            // Nível de profundidade não se aplica a tradução (tem campo de tom próprio)
            // nem a geração de imagem (não é uma resposta explicativa).
            const depthField = document.getElementById('depthLevelField');
            depthField.style.display = (category === 'traducao' || category === 'imagem') ? 'none' : 'block';
        }

        // Chamada inicial para campos dinâmicos
        updateDynamicFields();

        // As funções depthInstructions, buildResearchPrompt e buildTechnicalPrompt
        // agora vivem em prompt-builder.js (carregado antes deste arquivo), para
        // poderem ser testadas automaticamente sem depender do navegador.
        // Veja tests/prompt-builder.test.js.

        function generatePrompt() {
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value.trim();
            const details = document.getElementById('details').value.trim();
            const depthLevel = document.getElementById('depthLevel').value;

            let prompt = '';

            if (category === 'pesquisa') {
                prompt = buildResearchPrompt(description, details, depthLevel);
            } else if (category === 'tecnico') {
                const programmingLanguage = document.getElementById('programmingLanguage').value.trim();
                const problemType = document.getElementById('problemType').value.trim();
                const environment = document.getElementById('environment').value.trim();
                prompt = buildTechnicalPrompt(description, details, depthLevel, programmingLanguage, problemType, environment);
            } else if (category === 'dados') {
                const dataType = document.getElementById('dataType').value.trim();
                const dataFormat = document.getElementById('dataFormat').value.trim();
                const analysisGoal = document.getElementById('analysisGoal').value.trim();
                prompt = buildDataAnalysisPrompt(description, details, depthLevel, dataType, dataFormat, analysisGoal);
            } else if (category === 'traducao') {
                const sourceLanguage = document.getElementById('sourceLanguage').value.trim();
                const targetLanguage = document.getElementById('targetLanguage').value.trim();
                const translationTone = document.getElementById('translationTone').value.trim();
                prompt = buildTranslationPrompt(description, details, sourceLanguage, targetLanguage, translationTone);
            } else if (category === 'imagem') {
                const imageStyle = document.getElementById('imageStyle').value.trim();
                const imageAspectRatio = document.getElementById('imageAspectRatio').value.trim();
                const imageAvoid = document.getElementById('imageAvoid').value.trim();
                prompt = buildImagePrompt(description, details, imageStyle, imageAspectRatio, imageAvoid);
            }

            const promptField = document.getElementById('promptText');
            promptField.value = prompt;
            autoGrowPromptText();
            setCustomSelectDisabled('aiTarget', false);
            document.getElementById('aiTarget').value = '';
            refreshCustomSelect('aiTarget');
            document.getElementById('openAiButton').disabled = true;
            document.getElementById('favoritePromptButton').disabled = false;
            document.getElementById('sharePromptButton').disabled = false;
            setFavoriteButtonBusy(false);

            saveToHistory({ category, description, prompt });
        }

        // Serviços com suporte a preenchimento automático via URL (?q=) usam o prompt
        // diretamente; os demais abrem a página inicial e contam com o prompt já
        // copiado para a área de transferência (cole com Ctrl+V ou Cmd+V).
        const AI_URLS = {
            gemini: () => `https://gemini.google.com/app`,
            chatgpt: (prompt) => `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`,
            claude: () => `https://claude.ai/new`,
            perplexity: (prompt) => `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
            copilot: () => `https://copilot.microsoft.com/`,
            deepseek: () => `https://chat.deepseek.com/`,
            grok: () => `https://grok.com/`
        };

        // Destinos que preenchem (e enviam) o prompt automaticamente via URL.
        const AUTO_SEND_TARGETS = new Set(['chatgpt', 'perplexity']);

        const TOAST_MESSAGES = {
            gemini: '&gt; prompt copiado — cole com Ctrl+V (ou Cmd+V) no Gemini_',
            chatgpt: '&gt; prompt copiado e enviado ao ChatGPT_',
            claude: '&gt; prompt copiado — cole com Ctrl+V (ou Cmd+V) no Claude_',
            perplexity: '&gt; prompt copiado e enviado ao Perplexity_',
            copilot: '&gt; prompt copiado — cole com Ctrl+V (ou Cmd+V) no Copilot_',
            deepseek: '&gt; prompt copiado — cole com Ctrl+V (ou Cmd+V) no DeepSeek_',
            grok: '&gt; prompt copiado — cole com Ctrl+V (ou Cmd+V) no Grok_'
        };

        function handleAiTargetChange() {
            const target = document.getElementById('aiTarget').value;
            document.getElementById('openAiButton').disabled = (target === '');
        }

        // Copia texto com fallback para navegadores/contextos sem Clipboard API
        // (ex.: http sem TLS, permissão negada, navegadores mais antigos).
        function copyToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise((resolve, reject) => {
                const helper = document.createElement('textarea');
                helper.value = text;
                helper.setAttribute('readonly', '');
                helper.style.position = 'fixed';
                helper.style.opacity = '0';
                document.body.appendChild(helper);
                helper.select();
                try {
                    const ok = document.execCommand('copy');
                    ok ? resolve() : reject(new Error('execCommand copy retornou false'));
                } catch (err) {
                    reject(err);
                } finally {
                    document.body.removeChild(helper);
                }
            });
        }

        function showErrorToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show', 'is-error');
            setTimeout(() => {
                toast.classList.remove('show', 'is-error');
            }, 3500);
        }

        function openSelectedAI() {
            const target = document.getElementById('aiTarget').value;
            if (!target) return;
            const prompt = document.getElementById('promptText').value;
            if (!prompt.trim()) return;
            copyToClipboard(prompt).then(() => {
                const toast = document.getElementById('toast');
                toast.innerHTML = TOAST_MESSAGES[target];
                toast.classList.add('show');
                const duration = AUTO_SEND_TARGETS.has(target) ? 3000 : 5000;
                setTimeout(() => toast.classList.remove('show'), duration);
                // noopener,noreferrer: evita que a nova aba tenha acesso via window.opener
                window.open(AI_URLS[target](prompt), '_blank', 'noopener,noreferrer');
            }).catch(() => {
                showErrorToast('> não foi possível copiar automaticamente. Selecione e copie o texto manualmente_');
                window.open(AI_URLS[target](prompt), '_blank', 'noopener,noreferrer');
            });
        }

        function copyPrompt() {
            const promptText = document.getElementById('promptText').value;
            if (!promptText) return;
            copyToClipboard(promptText).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> prompt copiado com sucesso_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }).catch(() => {
                showErrorToast('> não foi possível copiar automaticamente. Selecione e copie o texto manualmente_');
            });
        }

        // ---------- Lógica de instalação do app ----------
        let deferredInstallPrompt = null;

        function isStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone === true;
        }

        function isIOS() {
            return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
        }

        function showInstallBanner() {
            if (isStandalone()) return; // já instalado, não mostra nada
            document.getElementById('installBanner').classList.add('show');
        }

        function hideInstallBanner() {
            document.getElementById('installBanner').classList.remove('show');
        }

        // Chrome/Edge/Android disparam esse evento quando o app pode ser instalado
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            showInstallBanner();
        });

        window.addEventListener('appinstalled', () => {
            hideInstallBanner();
            deferredInstallPrompt = null;
        });

        document.getElementById('installNowBtn').addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                hideInstallBanner();
                deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
            } else if (isIOS()) {
                document.getElementById('iosModalOverlay').classList.add('show');
            }
        });

        document.getElementById('installLaterBtn').addEventListener('click', hideInstallBanner);

        document.getElementById('iosModalClose').addEventListener('click', () => {
            document.getElementById('iosModalOverlay').classList.remove('show');
        });
        document.getElementById('iosModalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'iosModalOverlay') {
                document.getElementById('iosModalOverlay').classList.remove('show');
            }
        });

        // No iPhone/iPad não existe o evento beforeinstallprompt, então mostramos
        // o banner manualmente (o botão abrirá o passo a passo em vez do prompt nativo)
        window.addEventListener('load', () => {
            if (isIOS() && !isStandalone()) {
                showInstallBanner();
            }
        });

        // Registra o Service Worker e fica de olho em novas versões do app
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then((registration) => {
                        // Verifica se já existe uma atualização esperando (ex: app reaberto)
                        if (registration.waiting) {
                            showUpdateBanner(registration);
                        }

                        // Detecta quando uma nova versão termina de baixar em segundo plano
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    showUpdateBanner(registration);
                                }
                            });
                        });

                        // Força uma verificação de atualização assim que o app abre
                        registration.update();
                    })
                    .catch((err) => console.error('Erro ao registrar service worker:', err));

                // Quando a nova versão assume o controle, recarrega a página automaticamente
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });
            });
        }

        function showUpdateBanner(registration) {
            const banner = document.getElementById('updateBanner');
            banner.classList.add('show');
            document.getElementById('updateNowBtn').onclick = () => {
                banner.classList.remove('show');
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            };
            document.getElementById('updateLaterBtn').onclick = () => {
                banner.classList.remove('show');
            };
        }

        // ================================
        // Histórico sincronizado (Firestore, por usuário)
        // ================================
        const HISTORY_LIMIT = 30;
        let historyCache = [];
        // ---------- Indicador de sincronização (feature nova) ----------
        // Usa snapshot.metadata do Firestore (hasPendingWrites / fromCache) pra saber
        // se os dados mostrados já foram confirmados no servidor ou ainda são locais —
        // é como a gente valida, visualmente, que o histórico está mesmo sincronizado
        // entre dispositivos (e não só salvo no cache deste aparelho).
        const syncFlags = {
            historyPendingWrites: false,
            historyFromCache: false,
            favoritesPendingWrites: false,
            favoritesFromCache: false
        };

        let lastSyncStatusKey = null;
        let syncStatusHideTimer = null;

        function updateSyncStatus() {
            const el = document.getElementById('syncStatus');
            const textEl = document.getElementById('syncStatusText');
            if (!el || !textEl) return;

            if (!auth.currentUser) {
                el.classList.remove('show');
                lastSyncStatusKey = null;
                return;
            }

            const offline = !navigator.onLine;
            const fromCache = syncFlags.historyFromCache || syncFlags.favoritesFromCache;
            const pending = syncFlags.historyPendingWrites || syncFlags.favoritesPendingWrites;

            let statusKey, label;
            if (offline) {
                statusKey = 'offline';
                label = 'Offline — sincroniza ao reconectar';
            } else if (fromCache || pending) {
                statusKey = 'syncing';
                label = 'Sincronizando…';
            } else {
                statusKey = 'synced';
                label = 'Sincronizado entre seus dispositivos';
            }

            el.classList.remove('is-synced', 'is-syncing', 'is-offline');
            el.classList.add('is-' + statusKey);
            textEl.textContent = label;

            // Só reabre o popup quando o status muda de verdade — evita ficar
            // piscando a cada pequena atualização de sincronização do Firestore.
            if (statusKey !== lastSyncStatusKey) {
                lastSyncStatusKey = statusKey;
                el.classList.add('show');
                clearTimeout(syncStatusHideTimer);
                syncStatusHideTimer = setTimeout(() => {
                    el.classList.remove('show');
                }, statusKey === 'offline' ? 6000 : 2600);
            }
        }

        window.addEventListener('online', updateSyncStatus);
        window.addEventListener('offline', updateSyncStatus);

        let historyUnsubscribe = null;

        function startHistoryListener(uid) {
            stopHistoryListener();
            historyUnsubscribe = db.collection('users').doc(uid).collection('prompts')
                .orderBy('createdAt', 'desc')
                .limit(HISTORY_LIMIT)
                .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
                    historyCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    renderHistoryList();
                    syncFlags.historyPendingWrites = snapshot.metadata.hasPendingWrites;
                    syncFlags.historyFromCache = snapshot.metadata.fromCache;
                    updateSyncStatus();
                }, (err) => {
                    console.error('Erro ao sincronizar histórico:', err);
                });
        }

        function stopHistoryListener() {
            if (historyUnsubscribe) {
                historyUnsubscribe();
                historyUnsubscribe = null;
            }
            historyCache = [];
            syncFlags.historyPendingWrites = false;
            syncFlags.historyFromCache = false;
            updateSyncStatus();
        }

        function saveToHistory({ category, description, prompt }) {
            const user = auth.currentUser;
            if (!user) return;
            db.collection('users').doc(user.uid).collection('prompts').add({
                category,
                description,
                prompt,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch((err) => {
                console.error('Não foi possível salvar no histórico:', err);
                showErrorToast('> não foi possível sincronizar o histórico (verifique sua conexão)_');
            });
        }

        function formatHistoryDate(timestamp) {
            if (!timestamp || typeof timestamp.toDate !== 'function') return 'agora mesmo';
            try {
                return timestamp.toDate().toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch {
                return '';
            }
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // ---------- Badge de categoria (histórico, favoritos, links, biblioteca) ----------
        // Mapa único de categoria -> {label, cssClass}, usado em todo lugar que renderiza
        // o "selinho" colorido, e também pra reconstruir a categoria a partir do badge
        // renderizado (ver importSharedPrompt) via atributo data-category — em vez de
        // comparar o texto do label, que quebraria com facilidade ao adicionar categorias.
        const CATEGORY_BADGES = {
            pesquisa: { label: 'Pesquisa', cssClass: 'history-badge' },
            tecnico: { label: 'Técnico', cssClass: 'history-badge tecnico' },
            dados: { label: 'Dados', cssClass: 'history-badge dados' },
            traducao: { label: 'Tradução', cssClass: 'history-badge traducao' },
            imagem: { label: 'Imagem', cssClass: 'history-badge imagem' }
        };

        function getCategoryBadge(category) {
            return CATEGORY_BADGES[category] || CATEGORY_BADGES.pesquisa;
        }

        // Retorna o HTML pronto do badge, já com data-category (usado para reconstruir
        // a categoria em importSharedPrompt sem depender do texto exibido).
        function categoryBadgeHtml(category) {
            const badge = getCategoryBadge(category);
            return `<span class="${badge.cssClass}" data-category="${category}">${badge.label}</span>`;
        }

        function renderHistoryList() {
            const container = document.getElementById('historyList');
            const clearRow = document.getElementById('historyClearRow');

            if (historyCache.length === 0) {
                container.innerHTML = '<div class="history-empty">Nenhum prompt gerado ainda.<br>Seus últimos ' + HISTORY_LIMIT + ' prompts vão aparecer aqui automaticamente, sincronizados com sua conta.</div>';
                clearRow.style.display = 'none';
                return;
            }

            clearRow.style.display = 'block';
            container.innerHTML = historyCache.map((item) => {
                const categoryBadge = getCategoryBadge(item.category);
                const shortDesc = (item.description || '').length > 140
                    ? item.description.slice(0, 140) + '…'
                    : (item.description || '');
                const isFavorited = favoritesCache.some((fav) => fav.sourceHistoryId === item.id);
                const starTitle = isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
                return `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-item-top">
                            <span class="${categoryBadge.cssClass}" data-category="${item.category}">${categoryBadge.label}</span>
                            <button type="button" class="history-fav-btn${isFavorited ? ' is-favorited' : ''}" data-action="favorite" data-id="${item.id}" title="${starTitle}" aria-label="${starTitle}">${isFavorited ? '★' : '☆'}</button>
                            <span class="history-time">${formatHistoryDate(item.createdAt)}</span>
                        </div>
                        <div class="history-desc">${escapeHtml(shortDesc)}</div>
                        <div class="history-actions">
                            <button type="button" class="history-restore-btn" data-action="restore" data-id="${item.id}">↺ Restaurar</button>
                            <button type="button" class="history-share-btn" data-action="share" data-id="${item.id}">🔗 Compartilhar</button>
                            <button type="button" class="history-publish-btn" data-action="publish" data-id="${item.id}">🌐 Publicar</button>
                            <button type="button" class="history-delete-btn" data-action="delete" data-id="${item.id}">Excluir</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openHistoryPanel() {
            renderHistoryList();
            document.getElementById('historyOverlay').classList.add('show');
        }

        function closeHistoryPanel() {
            document.getElementById('historyOverlay').classList.remove('show');
        }

        function restoreFromHistory(id) {
            const item = historyCache.find((entry) => entry.id === id);
            if (!item) return;

            document.getElementById('promptText').value = item.prompt;
            autoGrowPromptText();
            setCustomSelectDisabled('aiTarget', false);
            document.getElementById('aiTarget').value = '';
            refreshCustomSelect('aiTarget');
            document.getElementById('openAiButton').disabled = true;
            setFavoriteButtonBusy(false);
            document.getElementById('favoritePromptButton').disabled = false;
            document.getElementById('sharePromptButton').disabled = false;

            closeHistoryPanel();
            document.getElementById('output').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function deleteHistoryItem(id) {
            const user = auth.currentUser;
            if (!user) return;
            db.collection('users').doc(user.uid).collection('prompts').doc(id).delete()
                .catch((err) => console.error('Erro ao excluir item do histórico:', err));
        }

        function clearHistory() {
            const user = auth.currentUser;
            if (!user || historyCache.length === 0) return;
            const batch = db.batch();
            historyCache.forEach((item) => {
                batch.delete(db.collection('users').doc(user.uid).collection('prompts').doc(item.id));
            });
            batch.commit().catch((err) => console.error('Erro ao limpar histórico:', err));
        }

        document.getElementById('historyTrigger').addEventListener('click', openHistoryPanel);
        document.getElementById('historyClose').addEventListener('click', closeHistoryPanel);
        document.getElementById('historyOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'historyOverlay') closeHistoryPanel();
        });
        document.getElementById('historyClearBtn').addEventListener('click', clearHistory);
        document.getElementById('historyList').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const { action, id } = btn.dataset;
            if (action === 'restore') restoreFromHistory(id);
            if (action === 'delete') deleteHistoryItem(id);
            if (action === 'favorite') toggleFavoriteFromHistory(id);
            if (action === 'share') shareHistoryItem(id);
            if (action === 'publish') publishHistoryItem(id);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeHistoryPanel();
                closeFavoritesPanel();
                closeMySharesPanel();
                closeSharedPromptPanel();
                closePublicLibraryPanel();
            }
        });

        // ================================
        // Favoritos (Firestore, por usuário) — feature nova
        // ================================
        let favoritesCache = [];
        let favoritesUnsubscribe = null;

        function startFavoritesListener(uid) {
            stopFavoritesListener();
            favoritesUnsubscribe = db.collection('users').doc(uid).collection('favorites')
                .orderBy('createdAt', 'desc')
                .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
                    favoritesCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    renderFavoritesList();
                    // Os favoritos também aparecem marcados com estrela dentro do histórico —
                    // atualiza a estrela lá se o painel de histórico já tiver sido montado.
                    if (document.getElementById('historyList').innerHTML) renderHistoryList();
                    syncFlags.favoritesPendingWrites = snapshot.metadata.hasPendingWrites;
                    syncFlags.favoritesFromCache = snapshot.metadata.fromCache;
                    updateSyncStatus();
                }, (err) => {
                    console.error('Erro ao sincronizar favoritos:', err);
                });
        }

        function stopFavoritesListener() {
            if (favoritesUnsubscribe) {
                favoritesUnsubscribe();
                favoritesUnsubscribe = null;
            }
            favoritesCache = [];
            syncFlags.favoritesPendingWrites = false;
            syncFlags.favoritesFromCache = false;
            updateSyncStatus();
        }

        function addFavorite({ category, description, prompt, sourceHistoryId }) {
            const user = auth.currentUser;
            if (!user) {
                showErrorToast('> crie uma conta (ou entre) para favoritar prompts_');
                return Promise.reject(new Error('SEM_USUARIO'));
            }
            const data = {
                category,
                description,
                prompt,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (sourceHistoryId) data.sourceHistoryId = sourceHistoryId;
            return db.collection('users').doc(user.uid).collection('favorites').add(data)
                .catch((err) => {
                    console.error('Não foi possível favoritar:', err);
                    showErrorToast('> não foi possível favoritar agora (verifique sua conexão)_');
                    throw err;
                });
        }

        function setFavoriteButtonBusy(isFavorited) {
            const btn = document.getElementById('favoritePromptButton');
            btn.classList.toggle('is-active', isFavorited);
            btn.textContent = isFavorited ? '★ Favoritado' : '☆ Favoritar';
        }

        // Botão "☆ Favoritar" da área do prompt gerado — favorita o texto atual
        // (que pode já ter sido editado à mão, diferente do que foi salvo no histórico).
        function favoriteCurrentPrompt() {
            const prompt = document.getElementById('promptText').value.trim();
            if (!prompt) return;
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value.trim();

            addFavorite({ category, description, prompt }).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> prompt adicionado aos favoritos_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
                setFavoriteButtonBusy(true);
                setTimeout(() => setFavoriteButtonBusy(false), 2000);
            }).catch(() => {});
        }

        // Estrela dentro de um item do histórico — favorita/desfavorita aquele item
        // específico sem precisar restaurar e clicar em "Favoritar" separadamente.
        function toggleFavoriteFromHistory(id) {
            const existing = favoritesCache.find((fav) => fav.sourceHistoryId === id);
            if (existing) {
                removeFavorite(existing.id);
                return;
            }
            const item = historyCache.find((entry) => entry.id === id);
            if (!item) return;
            addFavorite({
                category: item.category,
                description: item.description,
                prompt: item.prompt,
                sourceHistoryId: id
            }).catch(() => {});
        }

        function renderFavoritesList() {
            const container = document.getElementById('favoritesList');
            const clearRow = document.getElementById('favoritesClearRow');

            if (favoritesCache.length === 0) {
                container.innerHTML = '<div class="history-empty">Nenhum prompt favoritado ainda.<br>Clique em "☆ Favoritar" no prompt gerado, ou na estrela de qualquer item do histórico.</div>';
                clearRow.style.display = 'none';
                return;
            }

            clearRow.style.display = 'block';
            container.innerHTML = favoritesCache.map((item) => {
                const categoryBadge = getCategoryBadge(item.category);
                const shortDesc = (item.description || '').length > 140
                    ? item.description.slice(0, 140) + '…'
                    : (item.description || '');
                return `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-item-top">
                            <span class="${categoryBadge.cssClass}" data-category="${item.category}">${categoryBadge.label}</span>
                            <span class="history-badge favorite">★ Favorito</span>
                            <span class="history-time">${formatHistoryDate(item.createdAt)}</span>
                        </div>
                        <div class="history-desc">${escapeHtml(shortDesc)}</div>
                        <div class="history-actions">
                            <button type="button" class="history-restore-btn" data-action="restore" data-id="${item.id}">↺ Restaurar</button>
                            <button type="button" class="history-share-btn" data-action="share" data-id="${item.id}">🔗 Compartilhar</button>
                            <button type="button" class="history-publish-btn" data-action="publish" data-id="${item.id}">🌐 Publicar</button>
                            <button type="button" class="history-delete-btn" data-action="delete" data-id="${item.id}">Remover</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openFavoritesPanel() {
            renderFavoritesList();
            document.getElementById('favoritesOverlay').classList.add('show');
        }

        function closeFavoritesPanel() {
            document.getElementById('favoritesOverlay').classList.remove('show');
        }

        function restoreFromFavorite(id) {
            const item = favoritesCache.find((entry) => entry.id === id);
            if (!item) return;

            document.getElementById('promptText').value = item.prompt;
            autoGrowPromptText();
            setCustomSelectDisabled('aiTarget', false);
            document.getElementById('aiTarget').value = '';
            refreshCustomSelect('aiTarget');
            document.getElementById('openAiButton').disabled = true;
            setFavoriteButtonBusy(false);
            document.getElementById('favoritePromptButton').disabled = false;
            document.getElementById('sharePromptButton').disabled = false;

            closeFavoritesPanel();
            document.getElementById('output').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function removeFavorite(id) {
            const user = auth.currentUser;
            if (!user) return;
            db.collection('users').doc(user.uid).collection('favorites').doc(id).delete()
                .catch((err) => console.error('Erro ao remover favorito:', err));
        }

        function clearFavorites() {
            const user = auth.currentUser;
            if (!user || favoritesCache.length === 0) return;
            const confirmed = confirm('Remover todos os prompts favoritados? Essa ação não pode ser desfeita.');
            if (!confirmed) return;
            const batch = db.batch();
            favoritesCache.forEach((item) => {
                batch.delete(db.collection('users').doc(user.uid).collection('favorites').doc(item.id));
            });
            batch.commit().catch((err) => console.error('Erro ao limpar favoritos:', err));
        }

        document.getElementById('favoritesTrigger').addEventListener('click', openFavoritesPanel);
        document.getElementById('favoritesClose').addEventListener('click', closeFavoritesPanel);
        document.getElementById('favoritesOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'favoritesOverlay') closeFavoritesPanel();
        });
        document.getElementById('favoritesClearBtn').addEventListener('click', clearFavorites);
        document.getElementById('favoritesList').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const { action, id } = btn.dataset;
            if (action === 'restore') restoreFromFavorite(id);
            if (action === 'delete') removeFavorite(id);
            if (action === 'share') shareFavoriteItem(id);
            if (action === 'publish') publishFavoriteItem(id);
        });

        // ================================
        // Compartilhamento por link (feature nova)
        // ================================
        // Os prompts compartilhados moram numa coleção separada (não dentro de
        // users/{uid}), porque quem recebe o link é OUTRA conta, não o dono.
        // Abrir um link exige login (mesmo requisito de histórico/favoritos) —
        // quem recebe pode ver, copiar e importar uma cópia pra própria conta.
        // O link fica ativo pra sempre até quem criou apagá-lo manualmente.
        let mySharesCache = [];
        let mySharesUnsubscribe = null;

        function buildShareUrl(shareId) {
            return `${window.location.origin}${window.location.pathname}?share=${shareId}`;
        }

        function getShareIdFromUrl() {
            return new URLSearchParams(window.location.search).get('share');
        }

        function createShareLink({ category, description, prompt }) {
            const user = auth.currentUser;
            if (!user) {
                showErrorToast('> crie uma conta (ou entre) para compartilhar prompts_');
                return Promise.reject(new Error('SEM_USUARIO'));
            }
            return db.collection('sharedPrompts').add({
                category,
                description,
                prompt,
                ownerUid: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then((docRef) => docRef.id).catch((err) => {
                console.error('Não foi possível criar o link:', err);
                showErrorToast('> não foi possível criar o link agora (verifique sua conexão)_');
                throw err;
            });
        }

        // Cria o link, copia pra área de transferência e avisa por toast — usado
        // tanto pelo botão da área de prompt gerado quanto pelos itens de histórico/favoritos.
        function createAndCopyShareLink({ category, description, prompt }) {
            createShareLink({ category, description, prompt }).then((shareId) => {
                const url = buildShareUrl(shareId);
                copyToClipboard(url).then(() => {
                    const toast = document.getElementById('toast');
                    toast.textContent = '> link copiado! válido até você removê-lo em "🔗 Links"_';
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 4000);
                }).catch(() => {
                    showErrorToast(`> link criado, mas não copiado automaticamente: ${url}`);
                });
            }).catch(() => {});
        }

        function shareCurrentPrompt() {
            const prompt = document.getElementById('promptText').value.trim();
            if (!prompt) return;
            createAndCopyShareLink({
                category: document.getElementById('category').value,
                description: document.getElementById('description').value.trim(),
                prompt
            });
        }

        function shareHistoryItem(id) {
            const item = historyCache.find((entry) => entry.id === id);
            if (!item) return;
            createAndCopyShareLink({ category: item.category, description: item.description, prompt: item.prompt });
        }

        function shareFavoriteItem(id) {
            const item = favoritesCache.find((entry) => entry.id === id);
            if (!item) return;
            createAndCopyShareLink({ category: item.category, description: item.description, prompt: item.prompt });
        }

        // ---------- Painel "🔗 Links" — meus links compartilhados ----------
        function startMySharesListener(uid) {
            stopMySharesListener();
            mySharesUnsubscribe = db.collection('sharedPrompts').where('ownerUid', '==', uid)
                .onSnapshot((snapshot) => {
                    mySharesCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    // Sem orderBy() na query (evita exigir índice composto no Firestore) —
                    // então ordena aqui mesmo, do mais recente pro mais antigo.
                    mySharesCache.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    renderMySharesList();
                }, (err) => {
                    console.error('Erro ao sincronizar meus links:', err);
                });
        }

        function stopMySharesListener() {
            if (mySharesUnsubscribe) {
                mySharesUnsubscribe();
                mySharesUnsubscribe = null;
            }
            mySharesCache = [];
        }

        function renderMySharesList() {
            const container = document.getElementById('mySharesList');
            if (mySharesCache.length === 0) {
                container.innerHTML = '<div class="history-empty">Nenhum link criado ainda.<br>Use o botão "🔗 Compartilhar" no prompt gerado, no histórico ou nos favoritos.</div>';
                return;
            }
            container.innerHTML = mySharesCache.map((item) => {
                const categoryBadge = getCategoryBadge(item.category);
                const shortDesc = (item.description || '').length > 140
                    ? item.description.slice(0, 140) + '…'
                    : (item.description || '');
                const url = buildShareUrl(item.id);
                return `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-item-top">
                            <span class="${categoryBadge.cssClass}" data-category="${item.category}">${categoryBadge.label}</span>
                            <span class="history-time">${formatHistoryDate(item.createdAt)}</span>
                        </div>
                        <div class="history-desc">${escapeHtml(shortDesc)}</div>
                        <div class="share-link-row">
                            <input type="text" readonly value="${escapeHtml(url)}" onclick="this.select()">
                        </div>
                        <div class="history-actions">
                            <button type="button" class="history-restore-btn" data-action="copylink" data-id="${item.id}">📋 Copiar link</button>
                            <button type="button" class="history-delete-btn" data-action="delete" data-id="${item.id}">Remover</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function copyMyShareLink(id) {
            const item = mySharesCache.find((entry) => entry.id === id);
            if (!item) return;
            copyToClipboard(buildShareUrl(id)).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> link copiado_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2500);
            }).catch(() => showErrorToast('> não foi possível copiar automaticamente. Selecione e copie o link manualmente_'));
        }

        function removeMyShare(id) {
            const user = auth.currentUser;
            if (!user) return;
            db.collection('sharedPrompts').doc(id).delete()
                .catch((err) => {
                    console.error('Erro ao remover link:', err);
                    showErrorToast('> não foi possível remover o link agora (verifique sua conexão)_');
                });
        }

        function openMySharesPanel() {
            renderMySharesList();
            document.getElementById('mySharesOverlay').classList.add('show');
        }

        function closeMySharesPanel() {
            document.getElementById('mySharesOverlay').classList.remove('show');
        }

        document.getElementById('mySharesTrigger').addEventListener('click', openMySharesPanel);
        document.getElementById('mySharesClose').addEventListener('click', closeMySharesPanel);
        document.getElementById('mySharesOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'mySharesOverlay') closeMySharesPanel();
        });
        document.getElementById('mySharesList').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const { action, id } = btn.dataset;
            if (action === 'copylink') copyMyShareLink(id);
            if (action === 'delete') removeMyShare(id);
        });

        // ---------- Abrir um prompt recebido por link (?share=ID na URL) ----------
        function renderSharedPromptNotFound() {
            document.getElementById('sharedPromptBody').innerHTML = `
                <div class="shared-prompt-notfound">
                    Este link não existe mais ou foi removido pela pessoa que compartilhou.
                </div>
            `;
        }

        function renderSharedPromptBody(shareId, data) {
            const categoryBadge = getCategoryBadge(data.category);
            document.getElementById('sharedPromptBody').innerHTML = `
                <div class="history-item-top">
                    <span class="${categoryBadge.cssClass}" data-category="${data.category}">${categoryBadge.label}</span>
                    <span class="history-time">${formatHistoryDate(data.createdAt)}</span>
                </div>
                <p class="shared-prompt-owner">Prompt compartilhado com você — importe pra editar e continuar usando na sua conta.</p>
                <p class="shared-prompt-desc">${escapeHtml(data.description || '')}</p>
                <textarea id="sharedPromptText" readonly>${escapeHtml(data.prompt || '')}</textarea>
                <div class="action-row">
                    <button type="button" onclick="copySharedPromptText()">✦ Copiar prompt</button>
                    <button type="button" class="secondary-action-btn" onclick="importSharedPrompt('${shareId}')">⭳ Importar pra minha conta</button>
                </div>
            `;
        }

        function copySharedPromptText() {
            const text = document.getElementById('sharedPromptText').value;
            copyToClipboard(text).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> prompt copiado com sucesso_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }).catch(() => showErrorToast('> não foi possível copiar automaticamente. Selecione e copie o texto manualmente_'));
        }

        function importSharedPrompt(shareId) {
            const textEl = document.getElementById('sharedPromptText');
            if (!textEl) return;
            // Relê a categoria/descrição a partir do painel renderizado (evita guardar estado à parte)
            const descEl = document.querySelector('#sharedPromptBody .shared-prompt-desc');
            const badgeEl = document.querySelector('#sharedPromptBody .history-badge');
            const category = (badgeEl && badgeEl.dataset.category) || 'pesquisa';
            saveToHistory({
                category,
                description: descEl ? descEl.textContent : '',
                prompt: textEl.value
            });
            const toast = document.getElementById('toast');
            toast.textContent = '> prompt importado para o seu histórico_';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function openSharedPrompt(shareId) {
            // Limpa o parâmetro da URL logo de cara, pra não reabrir esse link a cada
            // mudança de estado de autenticação (ex.: depois de confirmar o email).
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            document.getElementById('sharedPromptBody').innerHTML = '<div class="shared-prompt-notfound">Carregando prompt compartilhado…</div>';
            document.getElementById('sharedPromptOverlay').classList.add('show');
            db.collection('sharedPrompts').doc(shareId).get().then((doc) => {
                if (!doc.exists) {
                    renderSharedPromptNotFound();
                    return;
                }
                renderSharedPromptBody(shareId, doc.data());
            }).catch((err) => {
                console.error('Erro ao abrir prompt compartilhado:', err);
                renderSharedPromptNotFound();
            });
        }

        function closeSharedPromptPanel() {
            document.getElementById('sharedPromptOverlay').classList.remove('show');
        }

        document.getElementById('sharedPromptClose').addEventListener('click', closeSharedPromptPanel);
        document.getElementById('sharedPromptOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'sharedPromptOverlay') closeSharedPromptPanel();
        });

        // ================================
        // Biblioteca pública + avaliações (feature nova)
        // ================================
        // Publicação é sempre manual (a pessoa escolhe item por item, no histórico
        // ou nos favoritos — nunca automático). Só quem já IMPORTOU um prompt da
        // biblioteca pode avaliá-lo (isso é validado nas regras do Firestore, não
        // só no front-end — ver LEIA-ME-FIREBASE.md). Denúncias vão pra uma coleção
        // que só o dono do projeto lê pelo Console; remoção é manual por enquanto.
        let publicLibraryCache = [];
        let myPublicationsCache = [];
        let publicLibraryUnsubscribe = null;
        let myPublicationsUnsubscribe = null;
        let currentLibraryTab = 'explore';
        const LIBRARY_EXPLORE_LIMIT = 30;

        function publishToLibrary({ category, description, prompt }) {
            const user = auth.currentUser;
            if (!user) {
                showErrorToast('> crie uma conta (ou entre) para publicar na biblioteca_');
                return;
            }
            const ownerName = (user.displayName || user.email || 'Alguém').split(' ')[0];
            db.collection('publicPrompts').add({
                category,
                description,
                prompt,
                ownerUid: user.uid,
                ownerName,
                ratingSum: 0,
                ratingCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> publicado na biblioteca pública! gerencie em "🌐 biblioteca → minhas publicações"_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 4500);
            }).catch((err) => {
                console.error('Não foi possível publicar:', err);
                showErrorToast('> não foi possível publicar agora (verifique sua conexão)_');
            });
        }

        function publishHistoryItem(id) {
            const item = historyCache.find((entry) => entry.id === id);
            if (!item) return;
            publishToLibrary({ category: item.category, description: item.description, prompt: item.prompt });
        }

        function publishFavoriteItem(id) {
            const item = favoritesCache.find((entry) => entry.id === id);
            if (!item) return;
            publishToLibrary({ category: item.category, description: item.description, prompt: item.prompt });
        }

        function unpublishFromLibrary(id) {
            const user = auth.currentUser;
            if (!user) return;
            db.collection('publicPrompts').doc(id).delete()
                .catch((err) => {
                    console.error('Erro ao remover publicação:', err);
                    showErrorToast('> não foi possível remover agora (verifique sua conexão)_');
                });
        }

        // Importa uma cópia do prompt público pro meu histórico e cria a "marca" de
        // importação, que é o que libera a avaliação (checado nas regras do Firestore).
        function importFromLibrary(id) {
            const item = publicLibraryCache.find((entry) => entry.id === id);
            if (!item) return;
            const user = auth.currentUser;
            if (!user) {
                showErrorToast('> crie uma conta (ou entre) para importar prompts_');
                return;
            }
            saveToHistory({ category: item.category, description: item.description, prompt: item.prompt });
            db.collection('publicPrompts').doc(id).collection('imports').doc(user.uid).set({
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch((err) => console.error('Erro ao registrar importação:', err));

            const toast = document.getElementById('toast');
            toast.textContent = '> prompt importado! agora você já pode avaliá-lo_';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3500);
        }

        // Avaliação por transação: só assim dá pra manter ratingSum/ratingCount
        // consistentes mesmo com duas pessoas avaliando quase ao mesmo tempo.
        function ratePublicPrompt(id, stars) {
            const user = auth.currentUser;
            if (!user) {
                showErrorToast('> crie uma conta (ou entre) para avaliar prompts_');
                return;
            }
            const promptRef = db.collection('publicPrompts').doc(id);
            const ratingRef = promptRef.collection('ratings').doc(user.uid);

            db.runTransaction((transaction) => {
                return Promise.all([transaction.get(promptRef), transaction.get(ratingRef)]).then(([promptSnap, ratingSnap]) => {
                    if (!promptSnap.exists) throw new Error('PROMPT_REMOVIDO');
                    const promptData = promptSnap.data();
                    const oldStars = ratingSnap.exists ? ratingSnap.data().stars : 0;
                    const newRatingCount = ratingSnap.exists ? promptData.ratingCount : promptData.ratingCount + 1;
                    const newRatingSum = promptData.ratingSum - oldStars + stars;

                    transaction.set(ratingRef, { stars, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    transaction.update(promptRef, { ratingSum: newRatingSum, ratingCount: newRatingCount });
                });
            }).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> avaliação registrada, obrigado!_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }).catch((err) => {
                console.error('Erro ao avaliar:', err);
                if (err && err.code === 'permission-denied') {
                    showErrorToast('> importe este prompt primeiro para poder avaliá-lo_');
                } else {
                    showErrorToast('> não foi possível registrar a avaliação agora_');
                }
            });
        }

        function reportPublicPrompt(id) {
            const user = auth.currentUser;
            if (!user) return;
            const confirmed = confirm('Denunciar este prompt como impróprio? Nossa equipe vai revisar manualmente.');
            if (!confirmed) return;
            db.collection('reports').add({
                promptId: id,
                reportedBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                const toast = document.getElementById('toast');
                toast.textContent = '> denúncia enviada, obrigado por ajudar a manter a biblioteca saudável_';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 4000);
            }).catch((err) => {
                console.error('Erro ao denunciar:', err);
                showErrorToast('> não foi possível enviar a denúncia agora (verifique sua conexão)_');
            });
        }

        function startPublicLibraryListener() {
            stopPublicLibraryListener();
            publicLibraryUnsubscribe = db.collection('publicPrompts')
                .orderBy('createdAt', 'desc')
                .limit(LIBRARY_EXPLORE_LIMIT)
                .onSnapshot((snapshot) => {
                    publicLibraryCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    if (currentLibraryTab === 'explore') renderPublicLibraryList();
                }, (err) => console.error('Erro ao carregar biblioteca pública:', err));
        }

        function stopPublicLibraryListener() {
            if (publicLibraryUnsubscribe) {
                publicLibraryUnsubscribe();
                publicLibraryUnsubscribe = null;
            }
            publicLibraryCache = [];
        }

        function startMyPublicationsListener(uid) {
            stopMyPublicationsListener();
            myPublicationsUnsubscribe = db.collection('publicPrompts').where('ownerUid', '==', uid)
                .onSnapshot((snapshot) => {
                    myPublicationsCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    myPublicationsCache.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    if (currentLibraryTab === 'mine') renderPublicLibraryList();
                }, (err) => console.error('Erro ao carregar minhas publicações:', err));
        }

        function stopMyPublicationsListener() {
            if (myPublicationsUnsubscribe) {
                myPublicationsUnsubscribe();
                myPublicationsUnsubscribe = null;
            }
            myPublicationsCache = [];
        }

        function formatRatingSummary(item) {
            if (!item.ratingCount) return 'Ainda sem avaliações';
            const avg = (item.ratingSum / item.ratingCount).toFixed(1);
            const roundedStars = Math.round(item.ratingSum / item.ratingCount);
            const filled = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);
            return `<span class="stars-filled">${filled}</span> ${avg} (${item.ratingCount} avaliaç${item.ratingCount === 1 ? 'ão' : 'ões'})`;
        }

        function renderStarRatingWidget(id) {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<button type="button" data-action="rate" data-id="${id}" data-stars="${i}" aria-label="Avaliar com ${i} estrela(s)">★</button>`;
            }
            return `<div class="star-rating">${stars}<span class="star-rating-label">avaliar</span></div>`;
        }

        function renderPublicLibraryList() {
            const container = document.getElementById('publicLibraryList');
            const items = currentLibraryTab === 'explore' ? publicLibraryCache : myPublicationsCache;
            const isMineTab = currentLibraryTab === 'mine';

            if (items.length === 0) {
                container.innerHTML = isMineTab
                    ? '<div class="history-empty">Você ainda não publicou nada.<br>Use o botão "🌐 Publicar" no histórico ou nos favoritos.</div>'
                    : '<div class="history-empty">Ainda não há prompts públicos.<br>Seja a primeira pessoa a publicar um!</div>';
                return;
            }

            container.innerHTML = items.map((item) => {
                const categoryBadge = getCategoryBadge(item.category);
                const shortDesc = (item.description || '').length > 140
                    ? item.description.slice(0, 140) + '…'
                    : (item.description || '');
                const actionsHtml = isMineTab
                    ? `<button type="button" class="history-delete-btn" data-action="unpublish" data-id="${item.id}">Remover da biblioteca</button>`
                    : `
                        <button type="button" class="history-restore-btn" data-action="import" data-id="${item.id}">⭳ Importar</button>
                        <button type="button" class="history-report-btn" data-action="report" data-id="${item.id}">🚩 Denunciar</button>
                    `;
                return `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-item-top">
                            <span class="${categoryBadge.cssClass}" data-category="${item.category}">${categoryBadge.label}</span>
                            <span class="rating-summary">${formatRatingSummary(item)}</span>
                        </div>
                        ${!isMineTab ? `<p class="history-owner">Publicado por ${escapeHtml(item.ownerName || 'alguém')}</p>` : ''}
                        <div class="history-desc">${escapeHtml(shortDesc)}</div>
                        ${!isMineTab ? renderStarRatingWidget(item.id) : ''}
                        <div class="history-actions">${actionsHtml}</div>
                    </div>
                `;
            }).join('');
        }

        function switchLibraryTab(tab) {
            currentLibraryTab = tab;
            document.getElementById('libraryTabExplore').classList.toggle('active', tab === 'explore');
            document.getElementById('libraryTabMine').classList.toggle('active', tab === 'mine');
            renderPublicLibraryList();
        }

        function openPublicLibraryPanel() {
            if (!auth.currentUser) {
                showErrorToast('> crie uma conta (ou entre) para acessar a biblioteca pública_');
                return;
            }
            switchLibraryTab('explore');
            startPublicLibraryListener();
            startMyPublicationsListener(auth.currentUser.uid);
            document.getElementById('publicLibraryOverlay').classList.add('show');
        }

        function closePublicLibraryPanel() {
            document.getElementById('publicLibraryOverlay').classList.remove('show');
            // Só mantém histórico/favoritos ligados o tempo todo — a biblioteca é
            // consultada sob demanda, pra economizar leituras do plano gratuito.
            stopPublicLibraryListener();
            stopMyPublicationsListener();
        }

        document.getElementById('publicLibraryTrigger').addEventListener('click', openPublicLibraryPanel);
        document.getElementById('publicLibraryClose').addEventListener('click', closePublicLibraryPanel);
        document.getElementById('publicLibraryOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'publicLibraryOverlay') closePublicLibraryPanel();
        });
        document.getElementById('libraryTabExplore').addEventListener('click', () => switchLibraryTab('explore'));
        document.getElementById('libraryTabMine').addEventListener('click', () => switchLibraryTab('mine'));
        document.getElementById('publicLibraryList').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const { action, id, stars } = btn.dataset;
            if (action === 'import') importFromLibrary(id);
            if (action === 'report') reportPublicPrompt(id);
            if (action === 'unpublish') unpublishFromLibrary(id);
            if (action === 'rate') ratePublicPrompt(id, Number(stars));
        });

        // ---------- Política de Privacidade em painel sobreposto (em vez de nova aba) ----------
        function openPrivacyModal(e) {
            // Ctrl/Cmd/Shift/clique do meio: deixa o navegador abrir em nova aba normalmente
            if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return true;
            if (e) e.preventDefault();
            const frame = document.getElementById('privacyFrame');
            if (!frame.getAttribute('src')) frame.setAttribute('src', 'politica-privacidade.html');
            document.getElementById('privacyOverlay').classList.add('show');
            return false;
        }

        function closePrivacyModal() {
            document.getElementById('privacyOverlay').classList.remove('show');
        }

        document.getElementById('privacyOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'privacyOverlay') closePrivacyModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePrivacyModal();
        });
        // Permite que o link "← Voltar" dentro do iframe feche o painel em vez de navegar
        window.addEventListener('message', (e) => {
            if (e.source === document.getElementById('privacyFrame').contentWindow && e.data === 'closePrivacyModal') {
                closePrivacyModal();
            }
        });

        // ================================
        // Autenticação (login / cadastro / logout)
        // ================================
        const FREE_SEAT_LIMIT = 100;

        function switchAuthTab(which) {
            const isLogin = which === 'login';
            document.getElementById('tabLoginBtn').classList.toggle('is-active', isLogin);
            document.getElementById('tabSignupBtn').classList.toggle('is-active', !isLogin);
            document.getElementById('loginPane').hidden = !isLogin;
            document.getElementById('signupPane').hidden = isLogin;
            hideAuthError();
            hideAuthSuccess();
        }

        function showAuthError(message) {
            hideAuthSuccess();
            const box = document.getElementById('authErrorBox');
            box.textContent = message;
            box.hidden = false;
        }

        function hideAuthError() {
            document.getElementById('authErrorBox').hidden = true;
        }

        function showAuthSuccess(message) {
            hideAuthError();
            const box = document.getElementById('authSuccessBox');
            box.textContent = message;
            box.hidden = false;
        }

        function hideAuthSuccess() {
            document.getElementById('authSuccessBox').hidden = true;
        }

        function setAuthButtonsBusy(busy, activeLabel) {
            const loginBtn = document.getElementById('loginSubmitBtn');
            const signupBtn = document.getElementById('signupSubmitBtn');
            [loginBtn, signupBtn].forEach((btn) => {
                btn.disabled = busy;
            });
            const activeBtn = document.activeElement === signupBtn ? signupBtn : loginBtn;
            if (busy && activeLabel) {
                activeBtn.dataset.originalLabel = activeBtn.textContent;
                activeBtn.textContent = activeLabel;
            } else if (!busy) {
                [loginBtn, signupBtn].forEach((btn) => {
                    if (btn.dataset.originalLabel) {
                        btn.textContent = btn.dataset.originalLabel;
                        delete btn.dataset.originalLabel;
                    }
                });
            }
        }

        function translateAuthError(err) {
            const map = {
                'auth/email-already-in-use': 'Esse email já está cadastrado. Tente entrar.',
                'auth/invalid-email': 'Email inválido.',
                'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
                'auth/user-not-found': 'Email ou senha incorretos.',
                'auth/wrong-password': 'Email ou senha incorretos.',
                'auth/invalid-credential': 'Email ou senha incorretos.',
                'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
                'auth/network-request-failed': 'Sem conexão com a internet no momento.'
            };
            return (err && map[err.code]) || 'Não foi possível concluir. Tente novamente.';
        }

        async function handleLogin() {
            hideAuthError();
            hideAuthSuccess();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMeCheckbox').checked;
            if (!email || !password) {
                showAuthError('Preencha email e senha.');
                return;
            }
            setAuthButtonsBusy(true, 'Entrando...');
            try {
                // "Lembrar de mim" marcado: sessão persiste mesmo após fechar o navegador.
                // Desmarcado: sessão dura apenas enquanto a aba/janela estiver aberta.
                const persistence = rememberMe
                    ? firebase.auth.Auth.Persistence.LOCAL
                    : firebase.auth.Auth.Persistence.SESSION;
                await auth.setPersistence(persistence);
                await auth.signInWithEmailAndPassword(email, password);
                // A troca de tela acontece no listener onAuthStateChanged, mais abaixo.
            } catch (err) {
                showAuthError(translateAuthError(err));
            } finally {
                setAuthButtonsBusy(false);
            }
        }

        async function handleForgotPassword() {
            hideAuthError();
            hideAuthSuccess();
            const email = document.getElementById('loginEmail').value.trim();
            if (!email) {
                showAuthError('Digite seu email no campo acima e clique em "Esqueci minha senha" de novo.');
                return;
            }
            setAuthButtonsBusy(true, 'Enviando...');
            try {
                await auth.sendPasswordResetEmail(email);
                showAuthSuccess('Enviamos um link para redefinir sua senha em ' + email + '. Confira também a caixa de spam.');
            } catch (err) {
                // Por segurança, o Firebase às vezes retorna "user-not-found" — tratamos
                // como sucesso genérico para não revelar quais emails têm conta.
                if (err && err.code === 'auth/user-not-found') {
                    showAuthSuccess('Se esse email tiver uma conta, enviamos um link de redefinição de senha para ele.');
                } else {
                    showAuthError(translateAuthError(err));
                }
            } finally {
                setAuthButtonsBusy(false);
            }
        }

        async function handleSignup() {
            hideAuthError();
            hideAuthSuccess();
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

            if (!name || !email || !password || !passwordConfirm) {
                showAuthError('Preencha todos os campos.');
                return;
            }
            if (password.length < 6) {
                showAuthError('A senha precisa ter pelo menos 6 caracteres.');
                return;
            }
            if (password !== passwordConfirm) {
                showAuthError('As senhas não conferem.');
                return;
            }
            if (!document.getElementById('consentCheckbox').checked) {
                showAuthError('Você precisa concordar com a Política de Privacidade para criar uma conta.');
                return;
            }

            setAuthButtonsBusy(true, 'Criando conta...');
            let createdUser = null;
            try {
                // Contas novas começam com sessão persistente por padrão.
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                const credential = await auth.createUserWithEmailAndPassword(email, password);
                createdUser = credential.user;
                await createdUser.updateProfile({ displayName: name });
                createdUser.sendEmailVerification().catch((err) => {
                    // Não bloqueia o cadastro se o envio do email falhar — a pessoa
                    // ainda pode pedir reenvio depois, dentro do app.
                    console.error('Não foi possível enviar o email de verificação:', err);
                });

                // Cria o perfil e reserva 1 das FREE_SEAT_LIMIT vagas gratuitas de forma atômica.
                // As regras de segurança do Firestore (veja LEIA-ME-FIREBASE.md) validam
                // que o contador nunca ultrapassa FREE_SEAT_LIMIT — mesmo se dois cadastros
                // acontecerem ao mesmo tempo, só um deles consegue confirmar a transação.
                const statsRef = db.collection('meta').doc('stats');
                await db.runTransaction(async (tx) => {
                    const statsDoc = await tx.get(statsRef);
                    const count = statsDoc.exists ? (statsDoc.data().userCount || 0) : 0;
                    if (count >= FREE_SEAT_LIMIT) {
                        throw new Error('LIMITE_ATINGIDO');
                    }
                    tx.set(statsRef, { userCount: count + 1 }, { merge: true });
                    tx.set(db.collection('users').doc(createdUser.uid), {
                        name,
                        email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        privacyPolicyAcceptedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                // A troca de tela acontece no listener onAuthStateChanged, mais abaixo.
            } catch (err) {
                if (err && (err.message === 'LIMITE_ATINGIDO' || err.code === 'permission-denied')) {
                    showAuthError(`As ${FREE_SEAT_LIMIT} vagas gratuitas já foram todas preenchidas. Tente novamente mais tarde.`);
                } else {
                    showAuthError(translateAuthError(err));
                }
                // Se a conta de autenticação chegou a ser criada mas a vaga não foi confirmada,
                // desfaz para não deixar uma conta "fantasma" sem perfil.
                if (createdUser) {
                    await createdUser.delete().catch(() => {});
                }
            } finally {
                setAuthButtonsBusy(false);
            }
        }

        const GUEST_FLAG_KEY = 'promptFacil.guestMode';

        function showAppScreen(user) {
            document.getElementById('authScreen').hidden = true;
            document.getElementById('appScreen').hidden = false;

            const historyTrigger = document.getElementById('historyTrigger');
            const favoritesTrigger = document.getElementById('favoritesTrigger');
            const mySharesTrigger = document.getElementById('mySharesTrigger');
            const publicLibraryTrigger = document.getElementById('publicLibraryTrigger');
            const verifyBanner = document.getElementById('verifyEmailBanner');
            const deleteAccountBtn = document.getElementById('deleteAccountBtn');

            if (user) {
                sessionStorage.removeItem(GUEST_FLAG_KEY);
                historyTrigger.hidden = false;
                favoritesTrigger.hidden = false;
                mySharesTrigger.hidden = false;
                publicLibraryTrigger.hidden = false;
                const firstName = (user.displayName || user.email || '').split(' ')[0];
                document.getElementById('logoutBtnLabel').textContent = `Sair (${firstName})`;
                verifyBanner.hidden = user.emailVerified;
                deleteAccountBtn.hidden = false;
                startHistoryListener(user.uid);
                startFavoritesListener(user.uid);
                startMySharesListener(user.uid);
                updateSyncStatus();
            } else {
                // Modo visitante: sem conta, sem histórico/favoritos/links/biblioteca sincronizados, nada pra excluir.
                sessionStorage.setItem(GUEST_FLAG_KEY, '1');
                stopHistoryListener();
                stopFavoritesListener();
                stopMySharesListener();
                stopPublicLibraryListener();
                stopMyPublicationsListener();
                historyTrigger.hidden = true;
                favoritesTrigger.hidden = true;
                mySharesTrigger.hidden = true;
                publicLibraryTrigger.hidden = true;
                verifyBanner.hidden = true;
                deleteAccountBtn.hidden = true;
                closeHistoryPanel();
                closeFavoritesPanel();
                closeMySharesPanel();
                closePublicLibraryPanel();
                document.getElementById('logoutBtnLabel').textContent = 'Sair do modo visitante';
            }
        }

        function showAuthScreen() {
            stopHistoryListener();
            stopFavoritesListener();
            stopMySharesListener();
            stopPublicLibraryListener();
            stopMyPublicationsListener();
            document.getElementById('appScreen').hidden = true;
            document.getElementById('authScreen').hidden = false;
            document.getElementById('loginPassword').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupPasswordConfirm').value = '';
            hideAuthError();
            hideAuthSuccess();
            refreshSlotsNote();
        }

        function continueAsGuest() {
            showAppScreen(null);
        }

        function handleLogout() {
            closeHistoryPanel();
            closeFavoritesPanel();
            closeMySharesPanel();
            closeSharedPromptPanel();
            closePublicLibraryPanel();
            sessionStorage.removeItem(GUEST_FLAG_KEY);
            if (auth.currentUser) {
                auth.signOut(); // o listener onAuthStateChanged cuida de voltar pra tela de login
            } else {
                showAuthScreen();
            }
        }

        async function handleDeleteAccount() {
            const user = auth.currentUser;
            if (!user) return;

            const confirmed = confirm(
                'Isso vai apagar sua conta e todo o seu histórico de prompts PERMANENTEMENTE. ' +
                'Essa ação não pode ser desfeita. Deseja continuar?'
            );
            if (!confirmed) return;

            const deleteBtn = document.getElementById('deleteAccountBtn');
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Excluindo...';

            try {
                // 1. Apaga todo o histórico de prompts do usuário.
                const historySnap = await db.collection('users').doc(user.uid).collection('prompts').get();
                const batch = db.batch();
                historySnap.docs.forEach((doc) => batch.delete(doc.ref));
                batch.delete(db.collection('users').doc(user.uid));
                await batch.commit();

                // 2. Libera a vaga (decrementa o contador das FREE_SEAT_LIMIT vagas gratuitas).
                const statsRef = db.collection('meta').doc('stats');
                await db.runTransaction(async (tx) => {
                    const statsDoc = await tx.get(statsRef);
                    const count = statsDoc.exists ? (statsDoc.data().userCount || 0) : 0;
                    tx.set(statsRef, { userCount: Math.max(0, count - 1) }, { merge: true });
                });

                // 3. Apaga a conta de autenticação em si (email/senha deixam de existir).
                await user.delete();
                // A troca de tela acontece no listener onAuthStateChanged, mais abaixo.
            } catch (err) {
                if (err && err.code === 'auth/requires-recent-login') {
                    showErrorToast('Por segurança, faça login novamente e tente excluir a conta em seguida_');
                    auth.signOut();
                } else {
                    console.error('Erro ao excluir conta:', err);
                    showErrorToast('Não foi possível excluir a conta agora. Tente novamente em instantes_');
                }
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Excluir minha conta';
            }
        }

        function resendVerificationEmail() {
            const user = auth.currentUser;
            if (!user) return;
            const btn = document.getElementById('resendVerificationBtn');
            btn.disabled = true;
            user.sendEmailVerification()
                .then(() => {
                    const toast = document.getElementById('toast');
                    toast.textContent = '> email de confirmação reenviado_';
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 3500);
                })
                .catch(() => {
                    showErrorToast('> não foi possível reenviar agora. Tente de novo em instantes_');
                })
                .finally(() => {
                    btn.disabled = false;
                });
        }

        async function refreshSlotsNote() {
            const note = document.getElementById('authSlotsNote');
            try {
                const snap = await db.collection('meta').doc('stats').get();
                const count = snap.exists ? (snap.data().userCount || 0) : 0;
                const remaining = Math.max(0, FREE_SEAT_LIMIT - count);
                note.textContent = remaining > 0
                    ? `Restam ${remaining} de ${FREE_SEAT_LIMIT} vagas gratuitas nesta fase inicial.`
                    : 'As vagas gratuitas desta fase inicial já se esgotaram.';
            } catch {
                // Projeto do Firebase ainda não configurado (firebase-config.js) ou sem internet;
                // mantém o texto padrão do HTML nesse caso.
            }
        }

        auth.onAuthStateChanged((user) => {
            const pendingShareId = getShareIdFromUrl();
            if (user) {
                showAppScreen(user);
                if (pendingShareId) openSharedPrompt(pendingShareId);
            } else if (pendingShareId) {
                // Prompt compartilhado exige login — mesmo que a pessoa já tenha
                // usado o modo visitante antes, manda pra tela de entrar/criar conta.
                sessionStorage.removeItem(GUEST_FLAG_KEY);
                showAuthScreen();
                showErrorToast('> entre ou crie uma conta para abrir o prompt compartilhado_');
            } else if (sessionStorage.getItem(GUEST_FLAG_KEY) === '1') {
                showAppScreen(null);
            } else {
                showAuthScreen();
            }
        });

        document.getElementById('loginPassword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
        document.getElementById('signupPasswordConfirm').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSignup();
        });
