# Sumarização de histórico em conversas com LLM

**Categoria:** Conceitos Gerais de IA (Memória e contexto)
**Relevante em:** qualquer chat/agente com conversas longas, onde o histórico completo não cabe (ou fica caro) na janela de contexto
**Módulo que trata do assunto:** [modulo04/01-artigo-memoria-preferencias-e-resumo.md](../curso-apis-ia-generativa/modulo04/01-artigo-memoria-preferencias-e-resumo.md)

---

## O problema: contexto tem limite, e ele custa dinheiro

Todo modelo tem uma **janela de contexto** — o limite de quantos tokens ele
consegue "ver" numa chamada. Empilhar o histórico inteiro de uma conversa
longa dentro do prompt gera dois problemas: o custo por chamada sobe (mais
tokens = mais caro) e, eventualmente, o limite da janela é estourado.

## Sumarização: reduzir tokens sem perder tudo

**Sumarizar** (resumir) o histórico antigo é a técnica pra lidar com isso de
forma estruturada, em vez de simplesmente "jogar tudo no prompt e torcer":
troca-se o trecho antigo da conversa por um resumo curto, preservando o que
é relevante sem gastar tokens com o texto original inteiro.

O padrão comum não é resumir **tudo**: mantém-se o **histórico recente** na
íntegra (é onde normalmente está o contexto mais relevante pra resposta
imediata) e resume apenas o que já ficou distante na conversa.

## É uma decisão de arquitetura, não um detalhe

Remover ou resumir mensagens do histórico afeta diretamente:

- **Custo** — menos tokens enviados por chamada = mais barato e mais rápido
- **Qualidade da resposta** — se a remoção descartar informação importante,
  a resposta piora

Por isso essa escolha (quando resumir, o que manter na íntegra, quando
descartar) é tratada como decisão de arquitetura, e não como um ajuste
cosmético de performance.

### Exemplo de questão de revisão

> I. Sumarizar conversas antigas pode ajudar a reduzir tokens sem perder
> totalmente o contexto.
> II. Sumarização elimina a necessidade de histórico recente em qualquer
> chat.
> III. Remover mensagens do histórico é uma decisão de arquitetura que
> impacta custo e qualidade da resposta.

**Resposta correta: V, F, V**

- **I — Verdadeira.** É exatamente o que a sumarização resolve.
- **II — Falsa.** O padrão comum mantém o histórico recente na íntegra —
  sumarização substitui o que é antigo, não elimina a necessidade do que é
  recente. "Em qualquer chat" também generaliza demais.
- **III — Verdadeira.** Impacta custo (tokens) e qualidade (o que é
  descartado pode ser relevante) — não é detalhe de implementação.

## Duas categorias de memória, dois problemas diferentes

O módulo 4 separa memória em:

- **Memória de curto prazo** — histórico de mensagens de uma conversa
  específica (uma *thread*). É o que a sumarização gerencia.
- **Memória de longo prazo** — informações que persistem **entre**
  conversas diferentes (preferências do cliente). Como é um conjunto pequeno
  e estável de fatos, costuma ser injetada em praticamente todo prompt sem
  precisar de sumarização — é barata em tokens e traz valor de
  personalização.
