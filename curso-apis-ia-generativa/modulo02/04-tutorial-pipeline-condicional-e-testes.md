---
title: "Tutorial: nós de transformação e aresta condicional"
modulo: 2
aula: 4
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, conditional-edges, tdd]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/04-criando-pipeline-compl.md
---
# Tutorial: nós de transformação e aresta condicional

> Continuação prática de [Arestas condicionais: o fluxo que se ramifica de verdade](04-artigo-pipeline-condicional-e-testes.md).
> Continua o projeto do [tutorial da aula 3](03-tutorial-nodes-e-edges-lineares.md).
>
> Este tutorial explica **cada trecho de código linha a linha** — a ideia não é só copiar e colar, mas entender o porquê de cada decisão antes de seguir para a próxima aula.

## O que você vai construir

Dois nós de transformação de texto (`upperCaseNode`, `lowerCaseNode`) e a primeira **aresta condicional** de verdade, que usa o `command` calculado na aula anterior para desviar o fluxo:

```
START → identifyIntent ─┬─ "upper" → upperCaseNode  ─┐
                         ├─ "lower" → lowerCaseNode  ─┼─→ chatResponse → END
                         └─ (default, ainda sem nó)  ─┘
```

## Passo 1 — Escrever o teste antes da implementação (TDD)

Exemplo de caso: enviar uma mensagem pedindo para deixar o texto em maiúsculo, e esperar que a resposta venha transformada:

```ts
// tests/graph.test.ts
import { test } from "node:test";
import assert from "node:assert";
import { createServer } from "../src/server.ts";

test("command upper - transforma a mensagem em upper case", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "make this message upper please" },
  });

  const expected = "MAKE THIS MESSAGE UPPER PLEASE";
  assert.deepEqual(response.body, expected);
});
```

Linha a linha:

- `payload: { question: "make this message upper please" }`: a palavra `"upper"` dentro da frase é o gatilho que `identifyIntentNode` (implementado na aula anterior) procura para decidir o `command`.
- `const expected = "MAKE THIS MESSAGE UPPER PLEASE"`: a frase inteira em maiúsculo — o teste está validando que **a frase inteira** é transformada, não só a palavra "upper".
- `assert.deepEqual(response.body, expected)`: compara o corpo da resposta com o texto esperado. `deepEqual` (em vez de `strictEqual`) é usado aqui porque, dependendo de como a rota serializa a resposta, o corpo pode não ser uma string primitiva simples — `deepEqual` compara valor por valor em vez de exigir identidade estrita.

Rode o teste e confirme que ele falha (ainda não existe a transformação nem o roteamento) — é esperado. À medida que os próximos passos forem implementados, esse teste (e sua variação com `"lower"`) devem passar.

## Passo 2 — Criar `upperCaseNode` e `lowerCaseNode`

```ts
// src/graph/upperCaseNode.ts
import type { GraphState } from "./graph.ts";

export function upperCaseNode(state: GraphState): GraphState {
  return { ...state, output: state.output.toUpperCase() };
}
```

```ts
// src/graph/lowerCaseNode.ts
import type { GraphState } from "./graph.ts";

export function lowerCaseNode(state: GraphState): GraphState {
  return { ...state, output: state.output.toLowerCase() };
}
```

Linha a linha (vale para os dois arquivos, só muda o método de string usado):

- `state.output.toUpperCase()` / `.toLowerCase()`: `state.output` chega até aqui já preenchido pelo `identifyIntentNode` (aula anterior), que copiou o texto original da mensagem para esse campo. Cada um desses nós faz **uma única transformação**, focada — não decide rota, não formata mensagem, só transforma o texto. Essa responsabilidade única é o que torna fácil testar cada nó isoladamente, se quiser (chamando a função direto com um `state` fake, sem precisar rodar o grafo inteiro).
- `{ ...state, output: ... }`: o mesmo padrão de imutabilidade dos nós anteriores — todo o resto do estado (`messages`, `command`) segue inalterado, só `output` é sobrescrito.

Repare que nenhum dos dois nós mexe em `messages` — quem embrulha o resultado final numa `AIMessage` e adiciona ao histórico continua sendo o `chatResponseNode` (criado na aula anterior), que vem depois na cadeia.

## Passo 3 — A função de roteamento

```ts
// src/graph/graph.ts (continuação)
function routeByCommand(state: GraphState): string {
  switch (state.command) {
    case "upper":
      return "upperCaseNode";
    case "lower":
      return "lowerCaseNode";
    default:
      return "fallbackNode";
  }
}
```

Linha a linha:

- `function routeByCommand(state: GraphState): string`: essa função **não é um nó** — repare que ela não retorna um `GraphState`, retorna uma `string`. É uma **função de roteamento**: recebe o estado atual e devolve o **nome do próximo nó** a ser executado.
- `switch (state.command)`: examina o campo que `identifyIntentNode` preencheu na aula anterior.
- `case "upper": return "upperCaseNode"`: se o comando identificado foi `"upper"`, o próximo nó a rodar é aquele cujo identificador é a string `"upperCaseNode"` — que precisa bater exatamente com o nome usado em `.addNode(...)` no próximo passo.
- `case "lower": return "lowerCaseNode"`: mesma lógica para o caso `"lower"`.
- `default: return "fallbackNode"`: cobre **tudo o que não é `"upper"` nem `"lower"`** — inclusive `undefined`, que é o valor que `command` tem quando `identifyIntentNode` não reconheceu nenhuma palavra-chave. Repare que essa função já referencia `"fallbackNode"`, mesmo que esse nó só seja criado na próxima aula — por enquanto, se esse caso for atingido, o grafo vai dar erro ao tentar rotear para um nó que ainda não existe. Isso é esperado nesse ponto: essa aula foca só nos caminhos `"upper"` e `"lower"`.

## Passo 4 — Registrar os nós e a aresta condicional

```ts
// src/graph/graph.ts (continuação)
import { upperCaseNode } from "./upperCaseNode.ts";
import { lowerCaseNode } from "./lowerCaseNode.ts";

export function buildGraph() {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", identifyIntentNode)
    .addNode("upperCaseNode", upperCaseNode)
    .addNode("lowerCaseNode", lowerCaseNode)
    .addNode("chatResponse", chatResponseNode)
    .addEdge(START, "identifyIntent")
    .addConditionalEdges("identifyIntent", routeByCommand, {
      upperCaseNode: "upperCaseNode",
      lowerCaseNode: "lowerCaseNode",
    })
    .addEdge("upperCaseNode", "chatResponse")
    .addEdge("lowerCaseNode", "chatResponse")
    .addEdge("chatResponse", END);

  return workflow.compile();
}
```

Linha a linha (o que mudou em relação à aula anterior):

- `.addNode("upperCaseNode", upperCaseNode)`, `.addNode("lowerCaseNode", lowerCaseNode)`: os dois novos nós precisam ser **registrados** no grafo antes de qualquer aresta poder apontar para eles — se você esquecer de registrar um nó mas referenciá-lo numa aresta, o LangGraph acusa erro ao compilar.
- A aresta fixa antiga `.addEdge("identifyIntent", "chatResponse")` (da aula anterior) **sai** do código — ela é substituída pela aresta condicional abaixo.
- `.addConditionalEdges("identifyIntent", routeByCommand, { ... })`: recebe três argumentos.
  - `"identifyIntent"`: o nó **de origem** — depois que ele terminar, a decisão de rota entra em ação.
  - `routeByCommand`: a função do Passo 3, que examina o estado e devolve uma string.
  - `{ upperCaseNode: "upperCaseNode", lowerCaseNode: "lowerCaseNode" }`: um **mapa de tradução** entre o que `routeByCommand` pode devolver (a chave) e o identificador real do nó no grafo (o valor). Aqui as chaves e os valores são iguais de propósito — mas essa indireção existe porque, tecnicamente, sua função de roteamento poderia devolver um código interno diferente do nome do nó, e é esse mapa que faz a tradução. Repare que **o caso `fallbackNode` não está nesse mapa ainda** — ele só é adicionado na próxima aula, quando o nó correspondente existir de verdade.
- `.addEdge("upperCaseNode", "chatResponse")`, `.addEdge("lowerCaseNode", "chatResponse")`: duas arestas fixas — não importa qual dos dois caminhos foi seguido, ambos **convergem** para `chatResponse` antes do `END`. É esse padrão de convergência que aparece no diagrama do início do tutorial.

> **Erro comum nesse passo:** esquecer a extensão `.ts` nos imports relativos entre os arquivos do grafo — isso gera erro de "módulo não encontrado" ao rodar os testes. Confira as extensões se algo quebrar de repente depois de criar um novo arquivo de nó.

## Passo 5 — Rodar o teste do Passo 1 e duplicar para o caso `lower`

Rode os testes — o caso de `upper` já deve passar. Duplique o teste trocando o comando para `lower`:

```ts
test("command lower - transforma a mensagem em lower case", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "make this message lower please" },
  });

  const expected = "make this message lower please";
  assert.deepEqual(response.body, expected);
});
```

A única diferença em relação ao teste do Passo 1 é a palavra-chave (`"lower"` em vez de `"upper"`) e o resultado esperado (tudo minúsculo). Confirme que os dois testes passam.

Se você testar com um comando que não existe (ex.: `"comando desconhecido"`), o grafo vai tentar rotear para `"fallbackNode"` (Passo 3) e dar erro, porque esse nó ainda não foi criado nem registrado — isso é resolvido na [próxima aula](05-tutorial-fallback-e-ajustes-finais.md).

## Onde isso te deixa

O grafo agora ramifica de verdade: `identifyIntent` decide, `routeByCommand` traduz essa decisão numa rota, e os nós `upperCaseNode`/`lowerCaseNode` processam o texto antes de convergir em `chatResponse`. Falta só cobrir o caminho "não reconheci o comando" — o que fica para a última aula dessa sequência.

## Verifique seu entendimento

1. Qual a diferença entre um **nó** (`addNode`) e a **função de roteamento** usada em `addConditionalEdges` — em termos do que cada um recebe e do que cada um devolve?
2. No mapa passado como terceiro argumento de `addConditionalEdges`, por que existem chave e valor, se aqui eles são sempre iguais?
3. O que acontece, nesse ponto do tutorial, se `routeByCommand` devolver `"fallbackNode"`? Por quê?
4. Por que `upperCaseNode` e `lowerCaseNode` não criam uma `AIMessage` nem mexem em `messages`?
