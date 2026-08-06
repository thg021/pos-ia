---
title: "Tutorial: node de fallback e limpeza do histórico de mensagens"
modulo: 2
aula: 5
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, fallback, ai-message, fastify]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/05-definindo-node-de-fall.md
---
# Tutorial: node de fallback e limpeza do histórico de mensagens

> Continuação prática de [O caminho padrão: fallback, histórico de mensagens e a API por fora](05-artigo-fallback-e-ajustes-finais.md).
> Continua o projeto do [tutorial da aula 4](04-tutorial-pipeline-condicional-e-testes.md) — este é o último tutorial da sequência de nós/arestas do módulo 2.
>
> Este tutorial explica **cada trecho de código linha a linha** — a ideia não é só copiar e colar, mas entender o porquê de cada decisão antes de fechar o módulo.

## O que você vai construir

O nó `fallbackNode`, que fecha o grafo condicional criado na aula anterior, mais um ajuste no jeito como esse nó lida com o histórico de mensagens (`messages`) para evitar duplicação. Ao final, o grafo fica assim:

```
START → identifyIntent ─┬─ "upper" → upperCaseNode  ─┐
                         ├─ "lower" → lowerCaseNode  ─┼─→ chatResponse → END
                         └─ (nenhum) → fallbackNode  ─┘
```

## Passo 1 — Escrever o teste do caso de fallback

```ts
// tests/graph.test.ts (continuação)
test("comando desconhecido - retorna mensagem de fallback", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "unknown command" },
  });

  const expected =
    "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";
  assert.deepEqual(response.body, expected);
});
```

Linha a linha:

- `payload: { question: "unknown command" }`: um texto que não contém nem "upper" nem "lower" — é o gatilho para `identifyIntentNode` deixar `command` indefinido, o que (pela função `routeByCommand` da aula anterior) deve cair no caso `default`.
- `const expected = "..."`: o texto fixo que o `fallbackNode` vai devolver — definido antes da implementação existir, seguindo o mesmo TDD já usado nas aulas anteriores.

Rode o teste e confirme que ele falha com um erro de execução (o grafo tenta rotear para `"fallbackNode"`, mas esse nó ainda não existe) — é esperado nesse ponto.

## Passo 2 — Criar o `fallbackNode`

```ts
// src/graph/fallbackNode.ts
import { AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";

const FALLBACK_MESSAGE =
  "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";

export function fallbackNode(state: GraphState): GraphState {
  return {
    ...state,
    output: FALLBACK_MESSAGE,
    messages: [...state.messages, new AIMessage(FALLBACK_MESSAGE)],
  };
}
```

Linha a linha:

- `const FALLBACK_MESSAGE = "..."`: extraído para uma constante nomeada em vez de repetir a string literal duas vezes dentro da função — assim, se quiser mudar o texto, só precisa editar em um lugar, e o nome `FALLBACK_MESSAGE` já documenta a intenção sem precisar de comentário.
- `output: FALLBACK_MESSAGE`: preenche o campo que será lido pela rota HTTP como resposta final — o mesmo campo que `upperCaseNode`/`lowerCaseNode` preenchem nos outros dois caminhos.
- `messages: [...state.messages, new AIMessage(FALLBACK_MESSAGE)]`: aqui o `fallbackNode` está fazendo, ele mesmo, o trabalho que normalmente cabe ao `chatResponseNode` — embrulhar o texto numa `AIMessage` e adicionar ao histórico. Essa linha vai ser revisada no Passo 5, porque ela duplica a mensagem no histórico (o `chatResponse`, que roda logo depois, também cria uma `AIMessage`).

## Passo 3 — Registrar o nó e completar o mapa de roteamento

```ts
// src/graph/graph.ts (continuação)
import { fallbackNode } from "./fallbackNode.ts";

export function buildGraph() {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", identifyIntentNode)
    .addNode("upperCaseNode", upperCaseNode)
    .addNode("lowerCaseNode", lowerCaseNode)
    .addNode("fallbackNode", fallbackNode)
    .addNode("chatResponse", chatResponseNode)
    .addEdge(START, "identifyIntent")
    .addConditionalEdges("identifyIntent", routeByCommand, {
      upperCaseNode: "upperCaseNode",
      lowerCaseNode: "lowerCaseNode",
      fallbackNode: "fallbackNode",
    })
    .addEdge("upperCaseNode", "chatResponse")
    .addEdge("lowerCaseNode", "chatResponse")
    .addEdge("fallbackNode", "chatResponse")
    .addEdge("chatResponse", END);

  return workflow.compile();
}
```

Linha a linha (o que mudou em relação à aula anterior):

- `.addNode("fallbackNode", fallbackNode)`: registra o terceiro nó de processamento — sem esse registro, `routeByCommand` continuaria apontando para um nó inexistente.
- `fallbackNode: "fallbackNode"` dentro do mapa de `addConditionalEdges`: completa a tradução que faltava — agora, quando `routeByCommand` devolver a string `"fallbackNode"`, o grafo sabe para onde ir de verdade.
- `.addEdge("fallbackNode", "chatResponse")`: o terceiro (e último) caminho a convergir em `chatResponse`, fechando o padrão de "leque que se abre e converge" descrito no artigo.

`routeByCommand` (definida na aula anterior) não precisa de nenhuma mudança — o `default: return "fallbackNode"` já estava lá desde o início, só esperando o nó correspondente existir.

Rode os testes de novo — os três casos (`upper`, `lower`, comando desconhecido) devem passar agora.

## Passo 4 — Conferir o grafo completo no Studio

Abra o LangGraph Studio e observe o grafo: a partir de `identifyIntent`, três setas se abrem (`upperCaseNode`, `lowerCaseNode`, `fallbackNode`) e todas convergem em `chatResponse` antes do `END`. Clique em **New Thread** e mande mensagens diferentes para ver, passo a passo, qual caminho cada uma percorreu — inclusive é possível clicar em qualquer etapa da execução e inspecionar o estado (`JSON`) naquele ponto exato, útil para depuração no dia a dia.

Repare, nesse teste manual, que a mensagem de fallback aparece **duplicada** no histórico do chat — é o problema descrito no Passo 2, que o próximo passo corrige.

## Passo 5 — Ajuste fino: nem tudo precisa virar `AIMessage`

Se, ao testar, você notar mensagens duplicadas ou "barulho" no log do Studio, revise onde está criando `new AIMessage(...)`. O caso é exatamente o `fallbackNode` do Passo 2, que cria sua própria `AIMessage` **e** ainda passa pelo `chatResponseNode` (que cria outra `AIMessage` em cima do `output`).

A recomendação que fica da aula: reserve `AIMessage` para a resposta final de verdade (o que sai do `chatResponse`) e evite criar uma `AIMessage` extra dentro de nós intermediários só para guardar uma informação que já está sendo guardada em `output`. Ou seja, simplifique o `fallbackNode` removendo a criação manual de `AIMessage`:

```ts
// src/graph/fallbackNode.ts (versão ajustada)
import type { GraphState } from "./graph.ts";

const FALLBACK_MESSAGE =
  "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";

export function fallbackNode(state: GraphState): GraphState {
  return { ...state, output: FALLBACK_MESSAGE };
}
```

Removendo o campo `messages` do retorno e o `import { AIMessage }`, o nó volta a ter uma única responsabilidade: decidir o texto de saída. Quem se encarrega de transformar `output` numa `AIMessage` e adicioná-la ao histórico continua sendo, sempre, o `chatResponseNode` — que já roda logo depois, por causa da aresta `.addEdge("fallbackNode", "chatResponse")` do Passo 3. Isso deixa o histórico de mensagens mais limpo e mais fácil de entender depois. Rode os testes de novo para confirmar que continuam passando (o teste do Passo 1 valida só `output`, não `messages`, então não é afetado por essa mudança).

## Passo 6 — Testar como uma API HTTP comum

Depois de subir o projeto:

```bash
npm run dev
```

Teste com `curl`, sem depender do Studio:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "faça isso ficar em upper case"}'
```

Se preferir, use o mesmo `inject` do Fastify que já vinha sendo usado nos testes automatizados — o comportamento é equivalente, só troca a chamada de rede real por uma chamada simulada em processo. O ponto importante aqui: por trás do LangGraph tem uma API HTTP comum, publicável em qualquer lugar (seu próprio servidor, o LangGraph Studio, etc.), sempre respondendo pela mesma rota (`/chat`, nesse exemplo).

## Onde isso te deixa

Você tem agora um pipeline completo: identificação de intenção → roteamento condicional → processamento específico → resposta formatada → fallback para o caso não coberto. Essa é a espinha dorsal de praticamente qualquer agente de IA construído com LangGraph — o próximo passo natural (fora do escopo dessa aula) é trocar o `if`/`includes` do `identifyIntent` por uma chamada de verdade a um modelo de linguagem, pedindo para ele classificar a intenção em vez de usar comparação de texto.

### Lição de casa sugerida pela aula

Dar uma navegada na documentação oficial do LangGraph, prestando atenção especial em dois recursos que a aula não teve tempo de cobrir:

- **Memória**: como manter contexto entre conversas.
- **Human-in-the-loop**: como fazer o fluxo **parar e perguntar** para uma pessoa antes de continuar (por exemplo, antes de uma IA remover um arquivo), de forma parecida com confirmações que você já viu em ferramentas de IA prontas.

## Verifique seu entendimento

1. Antes do ajuste do Passo 5, por que a mensagem de fallback aparecia duplicada no histórico do LangGraph Studio?
2. Depois do ajuste do Passo 5, quem fica responsável por criar a `AIMessage` que representa a resposta de fallback?
3. O que faria `routeByCommand` continuar apontando para `"fallbackNode"` mesmo depois desse nó já estar implementado, se o `addConditionalEdges` não tivesse a entrada `fallbackNode: "fallbackNode"` no mapa?
4. Por que a aula reforça que "por trás do LangGraph tem uma API HTTP comum"? Que problema essa observação evita?
