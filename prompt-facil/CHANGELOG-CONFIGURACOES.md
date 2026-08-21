# Atualizações — Página de Configurações (versão Studio)

Implementação do checklist `melhorias-configuracoes.md` em cima da migração
para o layout Studio. Cobre praticamente todos os itens de prioridade alta e
média, e boa parte da baixa.

## ✅ Implementado

### Conta
- Nome de exibição (editar + salvar)
- Trocar senha (envia link de redefinição por email, reaproveitando o fluxo
  que já existia em "Esqueci minha senha")

### Assinatura
- Card "Assinatura" com plano atual, data do último pagamento confirmado e
  estimativa da próxima cobrança (ciclo mensal)
- Botão único "Gerenciar assinatura" — vira "Assinar Premium" (grátis) ou
  "Cancelar assinatura" (premium)
- **Histórico de pagamentos** — nova subcoleção `users/{uid}/pagamentos`,
  escrita pela Cloud Function `webhookAsaas` a cada evento de cobrança
- **Nova Cloud Function `cancelarAssinatura`** — cancela no Asaas e rebaixa
  o plano na hora (sem cálculo de proporcionalidade — ver nota abaixo)

### Preferências do gerador
- IA de destino padrão, categoria padrão, nível de profundidade padrão
- Toggle "Salvar histórico automaticamente"
- Sincroniza entre dispositivos (Firestore) para quem tem conta; local
  (localStorage) no modo visitante

### Aparência
- Tema com 3 opções: Claro / Escuro / **Sistema** (acompanha o SO, inclusive
  ao vivo se o SO mudar de tema com o app aberto)
- Compatível com quem já tinha tema salvo antes desta versão

### Notificações
- Toggles de "Novidades por email" e "Aviso de renovação" — preferências já
  ficam salvas na conta. **O disparo automático desses emails ainda não está
  implementado** (precisa de um serviço de envio, tipo SendGrid/Resend,
  ligado a uma Cloud Function — fica como próximo passo)

### Dados e Privacidade
- Novo: **Termos de Uso** (`termos-de-uso.html`, mesmo padrão visual da
  Política de Privacidade) — revisar com um advogado antes de publicar
  oficialmente
- **Exportar meus dados**: baixa histórico + favoritos em `.json`

### Segurança
- "Sessão atual": mostra data do último login e navegador/dispositivo
  (informativo — não é um gerenciador completo de múltiplos dispositivos)
- 2FA fica para uma versão futura (exige infraestrutura própria de SMS)

### Recursos futuros
- Toggle "Testar novidades em primeira mão" (opt-in de beta, salvo na conta)
- Linha "BYOK" com selo "Em breve" (placeholder honesto, sem funcionalidade
  ainda)

### Sobre e Suporte
- Versão do app
- Central de ajuda com 5 perguntas frequentes (acordeão)
- Botões "Avaliar na Play Store / App Store" — **preencha as URLs reais em
  `STORE_URLS` no topo de `app.js`** assim que o app for publicado; até lá,
  mostram um aviso "em breve"

## 🆕 Configurações também no layout Clássico

O painel de Configurações agora é **o mesmo elemento** nos dois layouts —
segue exatamente o padrão que o projeto já usava para Histórico, Favoritos,
Meus Links e Biblioteca Pública: um único bloco de conteúdo (`#sharedConfigBlock`)
que é realocado via JS (`applyLayout`) conforme o layout ativo, em vez de
duas versões separadas do mesmo conteúdo.

- **Studio**: continua como página fixa da barra lateral ("⚙ Configurações").
- **Clássico**: novo item "⚙ Configurações" no menu (☰ Menu), que abre um
  painel sobreposto com o conteúdo idêntico — mesmas seções, mesmos campos,
  mesmos botões.
- **Sair** e **Excluir minha conta** agora moram só dentro de Configurações
  (seção "Zona de risco") nos dois layouts — antes, no Clássico, ficavam
  soltos no menu e no rodapé. Isso elimina duplicação de elementos e garante
  que uma mudança em Configurações nunca fique disponível só num dos dois
  layouts.

## 📱 Validação mobile

Testado com viewports reais (375×667 iPhone SE, 390×844 iPhone 14, 360×800
Android, e 320×640 — a tela mais estreita ainda em uso hoje) nos dois
layouts, com e sem conta:

- **Zero overflow horizontal real** em qualquer combinação testada
  (`document.documentElement.scrollWidth` sempre igual à largura da tela).
- Encontrei um ponto frágil: o grupo de botões de tema (Claro/Escuro/Sistema)
  cabia em 320px por menos de 2px de margem — só funcionava por sorte, podia
  quebrar com uma fonte ligeiramente diferente ou zoom do usuário. Corrigido:
  agora ele — e o histórico de pagamentos, e os pares de botão
  nome+salvar / Play Store+App Store — têm permissão pra quebrar linha se a
  tela apertar, em vez de arriscar estourar.
- A barra de navegação horizontal do Studio (que rola de lado no celular)
  já existia antes desta atualização — não é um bug, é o padrão de menu
  mobile do layout Studio.

## ⚠️ Decisões importantes pra você revisar

1. **Cancelamento de assinatura é imediato**, sem manter o acesso premium
   até o fim do período já pago. Isso porque o app não guarda uma data de
   expiração hoje. Se quiser mudar esse comportamento (manter acesso até o
   fim do ciclo pago), é preciso passar a registrar a data de vencimento de
   cada cobrança — posso implementar isso depois, se fizer sentido pro
   negócio.
2. **Notificações por email são só preferência salva, ainda não disparam
   nada** — deixei isso explícito na própria tela do app, pra não prometer
   algo que não funciona ainda.
3. **BYOK é só um placeholder visual** ("Em breve") — não tem geração via IA
   de verdade implementada ainda (o gerador continua sendo por templates).

## 🔧 Para colocar no ar

1. Fazer deploy das Cloud Functions atualizadas: `firebase deploy --only functions`
   (adiciona `cancelarAssinatura` e a escrita em `pagamentos` dentro do `webhookAsaas`)
2. Atualizar as regras do Firestore com a nova regra de `pagamentos`
   (detalhes em `LEIA-ME-FIREBASE.md`)
3. Revisar o texto de `termos-de-uso.html` com um advogado antes de publicar
4. Preencher `STORE_URLS` em `app.js` quando o app for publicado nas lojas

## Testes
- 27/27 testes automatizados (`node --test`) continuam passando — nenhuma
  mudança tocou a lógica pura de geração de prompt
- Validação visual feita com Playwright, em viewport desktop, cobrindo os
  estados visitante / logado / premium — sem overflow horizontal detectado
