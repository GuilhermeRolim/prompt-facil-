# Testes automatizados

Este projeto agora tem testes automatizados para a lógica de geração de
prompt (o coração do produto): `buildResearchPrompt` e `buildTechnicalPrompt`,
extraídas para `prompt-builder.js`.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 18 ou superior instalado
(testado no Node 22). Não é preciso instalar nenhuma dependência — os
testes usam o test runner nativo do Node (`node:test`).

```bash
cd prompt-facil
npm test
```

ou diretamente:

```bash
node --test
```

Isso roda todos os arquivos em `tests/` e mostra quantos testes passaram/falharam.

## O que está coberto hoje

- `depthInstructions` — garante que os 3 níveis (iniciante/intermediário/avançado)
  existem e têm conteúdo.
- `buildResearchPrompt` — inclusão da descrição, do bloco de contexto opcional,
  da instrução de profundidade correta, e da estrutura numerada (1 a 8).
- `buildTechnicalPrompt` — inclusão condicional da linguagem de programação,
  montagem do bloco de contexto só com os campos preenchidos, instrução de
  profundidade correta, caracteres especiais na descrição, e estrutura
  numerada (1 a 7).

## Por que isso importa

`buildResearchPrompt`/`buildTechnicalPrompt` são funções puras (mesma entrada
sempre gera a mesma saída, sem depender da tela) — são as funções mais baratas
de testar automaticamente e as que mais importam: qualquer alteração acidental
nelas muda o produto que todo usuário recebe. Antes, uma mudança de uma vírgula
ou de uma condição `if` só seria percebida testando manualmente, campo por campo,
categoria por categoria, nível por nível. Agora isso é validado em menos de 1
segundo, toda vez que o código muda.

## Próximos passos sugeridos

- Rodar `npm test` automaticamente antes de cada deploy (ex.: GitHub Actions).
- Ampliar a cobertura para as demais funções puras do app conforme forem
  extraídas de `app.js` (ex.: `formatHistoryDate`, `escapeHtml`).

## Teste manual: histórico/favoritos sincronizados entre dispositivos

Isso depende do Firestore de verdade (não dá pra automatizar com `npm test`),
então o roteiro pra validar com as próprias mãos é:

1. Logue com a mesma conta em dois aparelhos/abas diferentes (ex.: celular e
   notebook, ou duas janelas anônimas do navegador).
2. Gere um prompt em um dos dois. Em alguns segundos ele deve aparecer no
   histórico do outro, sem precisar recarregar a página.
3. Favorite um item em um dos dois — a estrela deve aparecer preenchida
   também no outro aparelho.
4. Observe o indicador **"● Sincronizado entre seus dispositivos"** logo
   abaixo do topo da tela: ele deve estar verde e parado na maior parte do
   tempo. Ao gerar/favoritar algo, ele pisca em amarelo ("Sincronizando…")
   por um instante e volta pro verde assim que o Firestore confirma a
   escrita no servidor.
5. Pra simular offline: desligue o Wi-Fi/dados do aparelho (ou use a aba
   "Network" do DevTools em modo "Offline"). O indicador deve ficar vermelho
   ("Offline — sincroniza ao reconectar"). Gerar um prompt nesse estado ainda
   deve funcionar localmente; ao reconectar, ele sincroniza sozinho e o
   indicador volta pro verde.
