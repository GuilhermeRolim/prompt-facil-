# Correção — Menu mobile do layout Studio

## O problema
No celular, a barra lateral do Studio virava uma **faixa horizontal
rolável** com todos os botões (Novo prompt, Histórico, Favoritos, Modelos
por profissão, Meus Links, Biblioteca Pública, Assinar Premium,
Configurações, badge de plano, toggle de tema, toggle de layout — tudo
espremido numa linha só). Resultado: itens apareciam cortados/vazios
dependendo da posição do scroll, e a pessoa precisava arrastar o dedo pra
lá e pra cá pra encontrar o que precisava.

## A correção
Abaixo de 860px de largura, a barra lateral agora vira um **menu suspenso**
(mesmo padrão visual e de comportamento do "☰ Menu" que já existia no
layout Clássico):

- Um botão "☰ Menu" aparece no topo, ao lado do logo.
- Tocar nele abre uma lista vertical limpa com todas as opções — nada de
  scroll horizontal.
- O menu fecha sozinho ao escolher qualquer opção, ao tocar fora dele, ou
  ao apertar Esc (num teclado físico).
- Em telas largas (desktop/tablet, acima de 860px), nada muda — a barra
  lateral continua fixa e sempre visível, como sempre foi.

## Bug encontrado de quebra (não relacionado, mas corrigido)
Durante a validação, encontrei um bug pré-existente: o botão "Assinar
Premium" aparecia até para quem está no **modo visitante** (sem conta) — e
como assinar exige estar logado, clicar nele só mostrava um erro. A
intenção de escondê-lo pro visitante já existia no código, mas uma outra
função (`updatePlanoBadge`) reexibia o botão por engano logo em seguida.
Corrigido: agora ele só aparece pra quem tem conta e ainda não é premium.

## Validação
- Testado em 8 larguras (320px a 1280px) nos dois layouts — **zero
  overflow horizontal** em todas.
- Confirmado que o Studio abre/fecha/navega corretamente no menu mobile.
- Confirmado que o layout Clássico **não foi afetado** (continua com toggle
  de tema/layout sempre visível no topo, sem precisar abrir menu).
- 27/27 testes automatizados continuam passando.

## Observação de UX pra você avaliar
No Studio mobile, o toggle de tema e o toggle de layout (trocar pra
Clássico) agora ficam **dentro** do menu suspenso, exigindo um toque a mais
pra alcançar (antes ficavam na faixa horizontal, tecnicamente visíveis mas
exigindo scroll lateral pra achar). No Clássico, esses dois toggles
continuam sempre visíveis no topo, sem precisar abrir o menu. Se preferir
que o Studio mobile siga o mesmo padrão do Clássico (toggles sempre à
vista, fora do menu), é uma mudança pequena — me avisa que eu ajusto.
