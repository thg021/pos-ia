---
title: "Tutorial: implementando identifyIntent e chatResponse"
modulo: 2
aula: 3
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, nodes, edges]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/03-criando-estrutura-inic.md
---
# Tutorial: implementando identifyIntent e chatResponse

> Continuação prática de [Da caixa vazia à lógica de verdade: identifyIntent e chatResponse](03-artigo-nodes-e-edges-lineares.md).
> Continua o projeto do [tutorial da aula 2](02-tutorial-estado-e-primeiro-node.md).
>
> Este tutorial explica **cada trecho de código linha a linha** — a ideia não é só copiar e colar, mas entender o porquê de cada decisão antes de seguir para a próxima aula.

## O que você vai construir

Duas mudanças no grafo criado na aula anterior: `identifyIntentNode` ganha lógica de verdade (decide um `command` a partir do texto), e um novo nó `chatResponseNode` formata a resposta final. O grafo continua **linear** — a ramificação condicional só entra na próxima aula.

```
START → identifyIntent → chatResponse → END
```

## Passo 1 — Implementar `identifyIntentNode`

```ts
// src/graph/identifyIntentNode.ts
import type { GraphState } from "./graph.ts";

export function identifyIntentNode(state: GraphState): GraphState {
  const lastMessage = state.messages.at(-1);
  const input = lastMessage?.text ?? "";
  const inputLower = input.toLowerCase();

  let command: GraphState["command"];
  if (inputLower.includes("upper")) {
    command = "upper";
  } else if (inputLower.includes("lower")) {
    command = "lower";
  }

  return { ...state, command, output: input };
}
```

Linha a linha:

- `const lastMessage = state.messages.at(-1)`: `.at(-1)` é a forma moderna de pegar o **último item de um array** (equivalente a `array[array.length - 1]`, mas mais legível e sem risco de errar a conta do índice).
- `const input = lastMessage?.text ?? ""`: dois operadores encadeados. O `?.` (optional chaining) evita que o código quebre com um erro de "cannot read property of undefined" caso `lastMessage` seja `undefined` (por exemplo, se o array `messages` estiver vazio). O `?? ""` (nullish coalescing) entra em ação se o resultado de `lastMessage?.text` for `null` ou `undefined`, substituindo por uma string vazia — assim `input` nunca fica `undefined`, sempre é uma `string`.
- `const inputLower = input.toLowerCase()`: normaliza o texto para minúsculo antes de comparar, para que `"UPPER"`, `"Upper"` e `"upper"` sejam todos reconhecidos igual — evita ter que checar várias variações de capitalização manualmente.
- `let command: GraphState["command"]`: `GraphState["command"]` é um **acesso indexado de tipo** — em vez de repetir o tipo `"upper" | "lower" | undefined` na mão, ele "pergunta" ao tipo `GraphState` qual é o tipo do campo `command`. Se o schema do estado (da aula anterior) mudar, esse tipo se ajusta sozinho.
- O `if`/`else if` com `.includes(...)`: a lógica de decisão mais simples possível — sem nenhuma IA, só verifica se a substring aparece no texto. É proposital ser tão simples: o objetivo dessa fase é entender o **mecanismo de roteamento**, não construir um classificador de intenção sofisticado (isso fica para uma aula futura, com um modelo de verdade).
- Se nenhuma das duas condições bater, `command` continua `undefined` — na próxima aula, é exatamente esse `undefined` que vai cair no caso `default` do roteador condicional e mandar o fluxo para um nó de fallback.
- `return { ...state, command, output: input }`: o **spread operator** (`...state`) copia todos os campos do estado atual para um objeto novo, e na sequência `command` e `output: input` sobrescrevem só esses dois campos. Esse padrão — nunca alterar o objeto `state` recebido diretamente, sempre devolver uma cópia atualizada — é o mesmo princípio de imutabilidade que você já viu em `reducers` ou em atualizações de estado no frontend: evita bugs sutis de um nó alterar um objeto que outro nó ainda está usando.

## Passo 2 — Criar `chatResponseNode`

```ts
// src/graph/chatResponseNode.ts
import { AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";

export function chatResponseNode(state: GraphState): GraphState {
  const responseMessage = new AIMessage(state.output);

  return {
    ...state,
    messages: [...state.messages, responseMessage],
  };
}
```

Linha a linha:

- `import { AIMessage } from "@langchain/core/messages"`: `AIMessage` é uma classe do LangChain que representa uma mensagem "dita" pela IA (em contraste com `HumanMessage`, do usuário, e `SystemMessage`, de instruções de sistema). Embrulhar o texto nessa classe — em vez de deixar como string solta — é o que faz o LangGraph Studio reconhecer e exibir a mensagem corretamente na aba de chat.
- `const responseMessage = new AIMessage(state.output)`: cria a instância passando `state.output` — o texto que já foi processado por `identifyIntentNode` no Passo 1 (por enquanto, é o mesmo texto original, já que ainda não existe nenhum nó de transformação de verdade).
- `messages: [...state.messages, responseMessage]`: de novo o spread operator, agora num array — copia todas as mensagens já existentes e **adiciona** a nova no final, sem alterar o array original. É o mesmo raciocínio de imutabilidade do Passo 1, aplicado a um array em vez de um objeto.
- Repare que `output` **não** é alterado aqui — o nó só empacota o que já estava pronto dentro de uma mensagem formal.

## Passo 3 — Ligar `chatResponse` depois de `identifyIntent`

```ts
// src/graph/graph.ts (continuação)
import { identifyIntentNode } from "./identifyIntentNode.ts";
import { chatResponseNode } from "./chatResponseNode.ts";

export function buildGraph() {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", identifyIntentNode)
    .addNode("chatResponse", chatResponseNode)
    .addEdge(START, "identifyIntent")
    .addEdge("identifyIntent", "chatResponse")
    .addEdge("chatResponse", END);

  return workflow.compile();
}
```

Linha a linha (o que mudou em relação à aula anterior):

- `.addNode("chatResponse", chatResponseNode)`: registra o segundo nó — precisa acontecer antes de qualquer aresta poder referenciá-lo.
- `.addEdge("identifyIntent", "chatResponse")`: substitui a aresta antiga que ia direto para `END`. Agora, depois de `identifyIntent`, o fluxo **sempre** passa por `chatResponse` primeiro.
- `.addEdge("chatResponse", END)`: só depois de `chatResponse` formatar a resposta é que o grafo termina.

> **Erro comum nesse passo:** esquecer a extensão `.ts` nos imports relativos entre os arquivos do grafo — isso gera erro de "módulo não encontrado" ao rodar os testes. Confira as extensões se algo quebrar de repente depois de criar um novo arquivo de nó.

## Passo 4 — Conferir no LangGraph Studio

Rode `npm run dev` e abra o LangGraph Studio. No chat, envie uma mensagem contendo "upper" ou "lower" — por exemplo, `"faça isso ficar em upper case"`. Clique no nó `identifyIntent` na trilha de execução e confira, no `state` (JSON), que o campo `command` já vem preenchido corretamente.

Repare que, mesmo com `command` calculado certinho, a resposta final que volta pelo chat **ainda é o texto original**, sem nenhuma transformação — isso é esperado, porque ainda não existe nenhum nó que use `command` para de fato mudar `output`. Essa etapa (a aresta condicional de verdade) é o assunto da [próxima aula](04-tutorial-pipeline-condicional-e-testes.md).

## Onde isso te deixa

O grafo agora tem uma lógica real de decisão (`identifyIntent` calcula `command` a partir do texto) e um nó de formatação de resposta (`chatResponse`), mas o fluxo ainda é uma linha reta. Na próxima aula, você vai transformar essa linha reta numa ramificação condicional de verdade — o `command` calculado aqui vai finalmente decidir para onde o grafo desvia.

## Verifique seu entendimento

1. Por que `identifyIntentNode` usa `?.` e `??` juntos ao ler `lastMessage?.text ?? ""`? O que cada um resolve?
2. Se `identifyIntentNode` não reconhecer nenhuma palavra-chave no texto, qual é o valor final de `command`?
3. Por que `chatResponseNode` usa `[...state.messages, responseMessage]` em vez de `state.messages.push(responseMessage)`?
4. Nessa aula, `command` já é calculado corretamente, mas a resposta final ainda não muda de acordo com ele. Por quê?
