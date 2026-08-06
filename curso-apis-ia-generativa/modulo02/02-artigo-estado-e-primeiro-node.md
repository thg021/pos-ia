---
title: "O estado do grafo: a ficha que passa de nó em nó"
modulo: 2
aula: 2
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, state-graph, zod, fastify]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/02-gerenciando-estados-em.md
---
# O estado do grafo: a ficha que passa de nó em nó

> Aula "Gerenciando estados em fluxos, usando LangGraph Studio, expondo o projeto como Web API".
> Continuação de [O que é LangChain (e por que ele se chama assim)?](01-artigo-introducao-langchain-langgraph.md)

## Recapitulando rapidinho

Na aula anterior a gente descobriu que:

- **LangChain** dá as peças para encadear etapas de um fluxo de IA.
- **LangGraph** organiza essas peças como um **grafo** (um desenho com caixinhas conectadas por setas).
- **LangSmith** deixa a gente espiar o que aconteceu por trás de cada execução.

Só que ficou faltando responder a pergunta mais importante: **o que tem dentro dessas caixinhas, e como elas conversam entre si?** É exatamente isso que essa aula começa a explicar.

## Aproveitando o projeto anterior

Antes de mexer no grafo, a aula reorganiza o projeto para ficar mais enxuto: da API do módulo anterior, só o arquivo de entrada (`index`) e o de inicialização do servidor (`server`) são reaproveitados — qualquer service específico de outra integração (como o da OpenAI) é removido, junto com testes que não fazem mais sentido nesse novo projeto. Fica só **um teste simples**, que só confere se a API responde com status `200` — o suficiente para garantir que a estrutura básica funciona antes de começar a alterar a lógica.

Esse é um hábito que vale registrar: ao começar um projeto novo a partir de um anterior, é melhor **cortar o que não se aplica mais** do que carregar código morto — cada arquivo removido é uma fonte a menos de confusão futura.

## O "estado" é a memória compartilhada do grafo

Pensa no estado (*state*) como uma **ficha de anotações** que passa de mão em mão entre as etapas do seu fluxo. Cada etapa pode ler o que já está escrito ali, fazer o seu trabalho, e devolver a ficha atualizada para a próxima etapa.

Na aula, essa "ficha" guarda três coisas:

| Campo | Para que serve |
| ----- | --------------- |
| `messages` | O histórico de mensagens trocadas (obrigatório — é o que faz a aba de chat do LangGraph Studio funcionar). |
| `output` | O texto final que vai ser devolvido para quem está usando a aplicação. |
| `command` | Uma "opção" escolhida, por exemplo `upper` (deixar maiúsculo) ou `lower` (deixar minúsculo) — usada mais pra frente para decidir qual caminho o fluxo deve seguir. |

Esse "formato" da ficha é descrito com o **Zod**, uma biblioteca de validação que você já deve ter usado em outros contextos (tipo validar o corpo de uma requisição HTTP). O LangChain já usa o Zod por baixo dos panos, então dá pra reaproveitar o que você já sabe.

> **Detalhe técnico que vale registrar:** no momento dessa aula, o LangChain estava na versão `1.x` (a versão estável mais nova), mas havia um bug conhecido que impedia a aba de chat do Studio de funcionar direito com a forma "oficial" mostrada na documentação. O instrutor usou uma solução alternativa encontrada em uma *issue* do GitHub do projeto: descrever o estado usando **Zod na versão 3** (`zod@3`), em vez da versão mais recente do Zod. Isso é um lembrete de que, em bibliotecas de IA que mudam rápido, às vezes a documentação oficial fica um passo atrás — e vale a pena checar issues abertas quando algo não funciona como esperado.

## Nós (*nodes*): cada opção que o fluxo pode executar

Um **nó** é simplesmente uma função. Ela recebe o estado atual (a "ficha"), pode fazer o que for preciso — chamar uma API, rodar uma lógica, chamar um modelo de IA — e **sempre devolve o estado** (atualizado ou não) para o próximo passo.

A analogia que a aula usa: pensa nos nós como as **opções de um menu**. Alguns exemplos possíveis de nó: "pesquisar na internet", "transformar em CSV", "transformar em SQL", "transformar em script". Cada uma dessas opções vira uma função separada. Quantos nós você quiser — o grafo pode ter vários.

Nessa aula, o primeiro nó criado se chama `identifyIntent` (algo como "identificar a intenção" do que o usuário pediu). Nessa primeira versão, ele ainda não faz nenhum processamento de verdade — só recebe o estado e devolve ele para frente, sem alterar nada. É um placeholder: serve para testar se a "fiação" do grafo está correta antes de colocar lógica de verdade dentro (isso só acontece na próxima aula).

## Arestas (*edges*): a ordem de execução

Se os nós são "o que" pode ser feito, as **arestas** definem "em que ordem" as coisas acontecem. É literalmente como um cadeado de funções: "depois dessa função, chama essa outra", e assim por diante — voltando à ideia de "corrente" que dá nome ao LangChain.

Todo grafo tem dois pontos especiais: **`START`** (o ponto de entrada) e **`END`** (o ponto de saída). Na versão mais simples criada nessa aula, o fluxo é:

```
START → identifyIntent → END
```

Ou seja: começa, roda o nó `identifyIntent`, termina. Só isso — mas já é o suficiente para aparecer desenhado no LangGraph Studio e confirmar que a estrutura básica está funcionando.

## Por que fazer um exemplo de "deixar maiúsculo/minúsculo"?

Pode parecer bobo treinar um fluxo de IA com uma tarefa tão simples, mas é proposital: como ainda não tem nenhum modelo de IA plugado, o objetivo é só **enxergar os nós sendo ativados e executados**, sem a complexidade extra de lidar com respostas de um LLM. A ideia é que, dependendo de um "comando" enviado (`upper` ou `lower`), o fluxo tome caminhos diferentes mais pra frente — isso é o começo de um **fluxo condicional**, aprofundado nas próximas duas aulas.

## Expondo o grafo como uma Web API

Depois de montar o grafo, ele precisa ser "plugado" na API que já existia (construída com Fastify no módulo anterior). A receita é direta:

1. Importa a função que constrói o grafo (`buildGraph`).
2. Cria uma instância do grafo uma vez: `const graph = buildGraph();`
3. Dentro da rota HTTP, chama `await graph.invoke({ ...estado inicial... })`.
4. Devolve para quem chamou a API o campo `output` do resultado — que é exatamente o campo que a gente definiu lá no estado.

Um detalhe importante: a mensagem do usuário não é passada como uma string qualquer — ela é embrulhada numa `HumanMessage` (mensagem humana), porque o LangChain trabalha com o conceito de que mensagens podem vir de fontes diferentes: do usuário (`HumanMessage`), da própria IA (`AIMessage`) ou do sistema (`SystemMessage`). Isso importa porque, mais pra frente, o modelo de IA vai usar esse "papel" (quem disse o quê) para entender o contexto da conversa.

## Ligando ao LangGraph Studio

Para o LangGraph Studio conseguir "achar" o grafo (e não só a API rodar por baixo dos panos), é preciso exportar uma instância pronta — geralmente numa função `factory.ts`, que importa `buildGraph` e exporta uma constante `graph` já chamando essa função. É esse nome (`graph`) que precisa bater com o caminho configurado no `langgraph.json` (visto no [tutorial de configuração](01-tutorial-configurando-langchain-langgraph.md)).

Depois de conectar tudo, o Studio já mostra o nó `identifyIntent` no desenho do grafo, e o campo `output` do estado aparece atualizado — mesmo sem nenhuma transformação de verdade ainda acontecendo, é a confirmação de que o "fio" entre o código e a interface visual está funcionando.

## Fechando o raciocínio

Essa aula fecha o ciclo mínimo: **definir o formato do estado → criar um primeiro nó → ligar `START`/`END` → expor pela API → visualizar no Studio**. É esse ciclo que se repete (com mais nós e mais lógica) em qualquer grafo do LangGraph, não importa o tamanho. A partir da próxima aula, o `identifyIntent` deixa de ser um placeholder e ganha lógica de verdade.

Para o passo a passo com o código completo explicado linha a linha, veja o [tutorial complementar](02-tutorial-estado-e-primeiro-node.md).
