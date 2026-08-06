---
title: "O caminho padrão: fallback, histórico de mensagens e a API por fora"
modulo: 2
aula: 5
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, fallback, ai-message, fastify]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/05-definindo-node-de-fall.md
---
# O caminho padrão: fallback, histórico de mensagens e a API por fora

> Aula "Definindo node de fallback, implementando casos de teste restantes".
> Continuação de [Arestas condicionais: o fluxo que se ramifica de verdade](04-artigo-pipeline-condicional-e-testes.md).
> Fecha a sequência de aulas do módulo 2 dedicada a nós, arestas e roteamento condicional.

## Onde a gente parou

O grafo já roteava de verdade entre `upperCaseNode` e `lowerCaseNode`, mas a função de roteamento (`routeByCommand`) já apontava para um terceiro caminho — `"fallbackNode"` — que ainda não existia como nó registrado. Essa aula fecha esse buraco e usa o resultado para revisar um detalhe sutil sobre como o LangChain trata mensagens.

## O nó de fallback: o que fazer quando nada bate

Todo roteamento condicional precisa de uma rota padrão para quando nenhuma das opções esperadas se encaixa. Na aula, o `fallbackNode` simplesmente devolve uma mensagem fixa avisando que o comando não foi reconhecido, sugerindo as opções válidas (`upper case` ou `lower case`).

Isso não é só um detalhe de exemplo — é uma prática importante em qualquer sistema que decide baseado em texto (seja com `if`s simples como neste grafo, seja mais pra frente com uma IA de verdade decidindo): a entrada do usuário é imprevisível, então o fluxo **sempre** precisa de uma rota de saída para o caso "não reconheci o que você pediu", evitando que a aplicação trave ou quebre silenciosamente.

Com o `fallbackNode` registrado, o grafo finalmente fica completo:

```
START → identifyIntent ─┬─ "upper" → upperCaseNode  ─┐
                         ├─ "lower" → lowerCaseNode  ─┼─→ chatResponse → END
                         └─ (nenhum) → fallbackNode  ─┘
```

Repare a forma do desenho: **três caminhos diferentes convergem no mesmo lugar** (`chatResponse`) antes de terminar. Isso é bem comum em fluxos de IA: várias estratégias diferentes, mas sempre passando pelo mesmo ponto de formatação final da resposta.

## Explorando a trilha de execução no LangGraph Studio

Com o grafo completo, a aula reforça um dos maiores diferenciais do LangGraph Studio: dá para clicar em **New Thread**, mandar mensagens diferentes, e ver — passo a passo — exatamente qual caminho cada uma percorreu. Clicando em qualquer etapa da execução, é possível inspecionar o `state` (JSON) naquele ponto exato: o que mudou, quando mudou, e por qual nó. É esse nível de visibilidade que faz o Studio funcionar como um "raio-x" da aplicação, útil no dia a dia mesmo em grafos bem maiores do que esse exemplo.

## Um detalhe sutil sobre os tipos de mensagem

Testando o `fallbackNode`, aparece uma observação interessante sobre como o LangChain trata mensagens. Existem (pelo menos) três "papéis":

- `HumanMessage` — o que o usuário digitou.
- `AIMessage` — o que a IA (ou, nesse exemplo sem IA, o próprio código) respondeu.
- `SystemMessage` — instruções de contexto/sistema.

A primeira versão do `fallbackNode` cria sua própria `AIMessage` e adiciona ao histórico — só que o nó seguinte, `chatResponse`, **também** cria uma `AIMessage` em cima do mesmo `output`. Resultado: a mensagem de fallback acaba aparecendo duplicada no log/histórico do LangGraph Studio.

A prática recomendada que fica registrada: guarde no array `messages` só as mensagens que realmente fazem parte da conversa com o usuário (`HumanMessage` e, quando fizer sentido, `SystemMessage`) e use `AIMessage` só para a resposta final de verdade — a que sai do `chatResponse`. Nós intermediários (como o `fallbackNode`) não precisam criar sua própria `AIMessage`; basta preencher `output` e deixar o `chatResponse`, que já roda logo em seguida, cuidar da formatação final. Isso deixa o histórico de mensagens mais limpo e mais fácil de entender depois.

## Testando pela API de verdade (não só pelo Studio)

Um lembrete importante da aula: o LangGraph Studio é uma ferramenta de depuração, mas **a aplicação continua sendo uma API HTTP comum**, igual qualquer outra construída com Fastify. Ou seja, dá para testar com `curl` normalmente, sem depender do Studio — reforçando que o cliente que consome essa API nem precisa saber que existe um grafo por trás. O LangGraph organiza a *lógica interna* da aplicação, mas por fora ela continua sendo uma API igual às que você já construiu em módulos anteriores.

## Fechando o módulo

O fluxo completo construído ao longo dessas quatro aulas mostra o padrão mais comum em agentes de IA: um nó inicial **identifica a intenção** do que foi pedido, uma **aresta condicional roteia** para o processamento adequado, e todos os caminhos convergem num nó final que **formata a resposta** — sempre com um caminho de fallback para o caso não coberto. Trocar o `if`/`includes` simplista do `identifyIntent` por uma chamada real a um modelo de IA (pedindo para ele classificar a intenção) é exatamente o próximo passo natural, e é isso que os próximos módulos do curso exploram.

### Lição de casa sugerida pela aula

Dar uma navegada na documentação oficial do LangGraph, prestando atenção especial em dois recursos que essa sequência de aulas não teve tempo de cobrir:

- **Memória**: como manter contexto entre conversas.
- **Human-in-the-loop**: como fazer o fluxo **parar e perguntar** para uma pessoa antes de continuar (por exemplo, antes de uma IA remover um arquivo), de forma parecida com confirmações que você já viu em ferramentas de IA prontas.

Para o passo a passo com o código completo explicado linha a linha, veja o [tutorial complementar](05-tutorial-fallback-e-ajustes-finais.md).
