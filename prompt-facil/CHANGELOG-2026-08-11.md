# Atualizações — 11/08/2026

Pacote com as melhorias combinadas após revisão do app (vídeos tema escuro/claro + código-fonte).

## Correções de bugs

1. **Indicador "Sincronizado entre seus dispositivos" sobrepondo o header.**
   Causa raiz: o elemento estava dentro de `.container`, que usa `backdrop-filter`.
   Isso faz o navegador tratar qualquer `position: fixed` interno como relativo ao
   container (não à tela), fazendo o toast nascer perto do topo, em cima do menu.
   Correção: o elemento foi movido para fora do `.container` no `index.html` e
   reposicionado para `bottom-left` (antes era `top-left`). Agora ele é
   realmente fixo à tela e não conflita mais com o header.
   Arquivos: `index.html`, `styles.css`.

2. **Autocomplete do navegador cobrindo o botão "Gerar meu Prompt".**
   Ao digitar em "Detalhes adicionais" ou "Descrição", o Chrome sugeria textos
   antigos e a lista de sugestões tampava o botão. Adicionado `autocomplete="off"`
   nesses dois campos.
   Arquivo: `index.html`.

## Novas funcionalidades

3. **Contador de caracteres na "Descrição da necessidade".**
   Mostra `N caracteres` abaixo do campo, com destaque visual sutil quando o
   texto está muito curto (< 15 caracteres) — ajuda a pessoa a perceber que
   descreveu pouco.
   Arquivos: `index.html`, `app.js`, `styles.css`.

4. **Botão "⧉ Copiar" avulso.**
   Antes só existia "Copiar e Abrir" (exige escolher uma IA de destino).
   Agora há um botão que copia o prompt para a área de transferência sem
   depender de selecionar destino — reaproveita a função `copyPrompt()` que já
   existia no código mas não estava ligada a nenhum botão. Ele acompanha o
   estado de habilitado/desabilitado dos botões "Favoritar"/"Compartilhar" em
   todos os fluxos (gerar, restaurar do histórico, restaurar dos favoritos).
   Arquivos: `index.html`, `app.js`.

5. **Aviso de "colar manual" vs. "preenche sozinho" no destino de IA.**
   As opções do dropdown "Abrir prompt em" agora deixam explícito quais IAs
   abrem já com o prompt preenchido (ChatGPT, Perplexity) e quais exigem colar
   manualmente (Gemini, Claude, Copilot, DeepSeek, Grok).
   Arquivo: `index.html`.

6. **Bloco "Modelo pronto por profissão" agora é recolhível (fechado por padrão).**
   Reduz a sobrecarga visual inicial para quem vai escrever a descrição do
   zero (o caso mais comum). A pessoa expande clicando no cabeçalho
   "⚡ Usar um modelo pronto por profissão (opcional)".
   Arquivos: `index.html`, `app.js`, `styles.css`.

## Observações técnicas

- Todos os 27 testes automatizados (`node --test`) continuam passando —
  nenhuma mudança tocou a lógica pura de geração de prompt
  (`prompt-builder.js`).
- Validação de responsividade: testei com um script Playwright que varre o
  DOM em viewport de 420px de largura e verifica se algum elemento ultrapassa
  os limites da tela. Nenhum overflow horizontal detectado após as correções
  (no meio do caminho, uma tentativa inicial de truncar texto com
  `white-space: nowrap` nos seletores customizados causou uma regressão de
  overflow horizontal em telas estreitas — foi identificada e revertida antes
  da entrega; os seletores voltaram ao comportamento original de quebrar
  linha em textos longos).
- Nenhuma dependência nova foi adicionada.
