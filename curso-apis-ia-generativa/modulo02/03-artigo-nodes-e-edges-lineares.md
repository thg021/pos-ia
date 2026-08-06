---
title: "Da caixa vazia à lógica de verdade: identifyIntent e chatResponse"
modulo: 2
aula: 3
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, nodes, edges]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/03-criando-estrutura-inic.md
---
# Da caixa vazia à lógica de verdade: identifyIntent e chatResponse

> Aula "Criando estrutura inicial de nodes e edges no LangChain".
> Continuação de [O estado do grafo: a ficha que passa de nó em nó](02-artigo-estado-e-primeiro-node.md).

## Onde a gente parou

Na aula anterior, o grafo tinha um único nó (`identifyIntent`), que só recebia o estado e devolvia ele intacto — um placeholder para confirmar que `START → identifyIntent → END` estava "fiado" corretamente. Essa aula faz esse nó **pensar de verdade** (mesmo que ainda sem IA) e adiciona um segundo nó, que formata a resposta final.

## `identifyIntent` deixa de ser um placeholder

A primeira mudança de verdade: `identifyIntent` passa a **ler a última mensagem** do array `messages` e decidir, com uma checagem de texto bem simples (sem nenhuma IA ainda), qual vai ser o `command`:

- Se o texto contém a palavra "upper" → `command = "upper"`.
- Se contém "lower" → `command = "lower"`.
- Se não bater com nenhuma das duas → `command` continua indefinido.

O ponto pedagógico aqui: o nó **não decide** para onde o fluxo vai — ele só anota uma informação no estado (`command`). Quem vai decidir o próximo passo, usando essa informação, é uma aresta condicional — só que essa parte fica para a próxima aula. Por enquanto, o fluxo continua **linear**: o `command` já é calculado e visível no LangGraph Studio, mas ainda não muda o caminho percorrido.

Além do `command`, o nó também copia o texto de entrada para o campo `output` — é esse valor que os próximos nós de transformação (`upperCaseNode`, `lowerCaseNode`, criados só na próxima aula) vão usar como ponto de partida.

## O segundo nó: `chatResponse`

Todo grafo que serve como chatbot precisa de um ponto de saída que formate a resposta de um jeito que o LangGraph Studio (e qualquer cliente) reconheça como "mensagem da IA". É esse o papel do nó `chatResponse`: ele pega o que já está em `state.output` e embrulha numa `AIMessage`, adicionando essa mensagem ao histórico (`messages`).

Por que embrulhar numa classe específica (`AIMessage`), em vez de simplesmente devolver a string? Porque o LangChain organiza conversas em torno do conceito de **papéis** — quem disse o quê. Isso importa mesmo sem IA nenhuma rodando ainda: é esse mesmo mecanismo que, mais pra frente, vai permitir que um modelo de linguagem "leia" o histórico e saiba diferenciar o que o usuário perguntou do que ele mesmo (o modelo) já respondeu antes.

## Ligando os dois nós (ainda sem condicional)

O grafo passa a ter essa forma:

```
START → identifyIntent → chatResponse → END
```

Ainda é uma linha reta — não existe ramificação nesse ponto. Mas já é suficiente para, testando pelo chat do LangGraph Studio, ver a resposta voltando formatada (mesmo que hoje ela seja só o texto original repetido, já que ainda não existe nenhum nó que realmente transforme o texto em maiúsculo ou minúsculo).

## Por que construir em passos tão pequenos?

Pode parecer devagar demais adicionar um nó de cada vez, testando a cada mudança — mas é exatamente essa disciplina que evita um problema comum ao montar grafos: quando várias peças mudam ao mesmo tempo (schema do estado, nós, arestas condicionais), fica difícil saber qual das mudanças quebrou o quê. Construindo nó a nó, aresta a aresta, sempre confirmando no LangGraph Studio antes de seguir, cada problema aparece isolado, no passo em que foi introduzido.

## Fechando o raciocínio

Com `identifyIntent` calculando `command` de verdade e `chatResponse` formatando a saída, o grafo já tem os dois "extremos" prontos: início (identificação) e fim (resposta). O que falta — e é o assunto da [próxima aula](04-artigo-pipeline-condicional-e-testes.md) — é usar esse `command` para **de fato** desviar o fluxo entre diferentes nós de processamento.

Para o passo a passo com o código completo explicado linha a linha, veja o [tutorial complementar](03-tutorial-nodes-e-edges-lineares.md).
