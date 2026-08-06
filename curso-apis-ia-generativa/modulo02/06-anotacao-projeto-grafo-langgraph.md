---
title: "Anotação: explicação linha a linha do grafo LangGraph (upper/lower/fallback)"
modulo: 2
aula: 1-5
tipo: anotacao
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langchain, langgraph, state-graph, annotation, conditional-edges, explicacao-linha-a-linha]
fonte: docs/curso-apis-ia-generativa/modulo02/project (projeto implementado a partir dos 5 tutoriais do módulo 2)
---
# Anotação: explicação linha a linha do projeto do módulo 2

Este documento explica, arquivo por arquivo e linha por linha, o projeto criado em
`docs/curso-apis-ia-generativa/modulo02/project/` — um grafo LangGraph que recebe uma
mensagem, decide se deve transformá-la em maiúsculas, minúsculas, ou cair num caminho
de fallback, e devolve isso por uma rota HTTP.

## Visão geral: o desenho do grafo

```
START → identifyIntent ─┬─ "upper" → upperCaseNode  ─┐
                         ├─ "lower" → lowerCaseNode  ─┼─→ chatResponse → END
                         └─ (nenhum) → fallbackNode  ─┘
```

E o mapa de quem chama quem no código:

```
index.ts  →  cria o servidor e sobe a API
   │
   └── server.ts  →  rota POST /chat, chama graph.invoke(...)
           │
           └── graph/graph.ts  →  monta o StateGraph inteiro
                   │
                   ├── identifyIntentNode.ts  (decide "command")
                   ├── upperCaseNode.ts / lowerCaseNode.ts  (transformam texto)
                   ├── fallbackNode.ts  (mensagem padrão se não reconheceu)
                   └── chatResponseNode.ts  (empacota a resposta final)

factory.ts  →  só exporta o grafo já montado, para o LangGraph Studio encontrar
```

---

## `package.json`

```json
1  {
2    "name": "modulo02-langgraph",
...
7    "scripts": {
8      "dev": "node --env-file .env --watch src/index.ts",
9      "test:dev": "node --env-file .env --test tests/**/*.test.ts"
10   },
...
14   "dependencies": {
15     "@langchain/langgraph": "^0.2.17",
16     "fastify": "^5.10.0",
17     "langchain": "^0.1.19"
18   },
```

- **Linha 9 (`test:dev`)**: o nome do script segue exatamente o que o tutorial pede
  (`npm run test:dev`, não só `npm test`) — mesma ideia do módulo 1: `--env-file .env`
  carrega as variáveis de ambiente (aqui, principalmente as do LangSmith) e `--test`
  aciona o test runner nativo do Node.
- **Linha 15-17**: as três versões vêm **fixadas** de propósito, seguindo a
  recomendação do tutorial ("importa porque a área de IA muda muito rápido"). Vale
  saber: essas versões têm vulnerabilidades de segurança conhecidas nas suas
  dependências internas (detalhe na seção final deste documento) — mantidas assim
  aqui por ser um projeto de estudo local, sem exposição a input externo.
- Repare que **não há `zod` nas dependências** — o tutorial original pedia para
  instalar `zod@3`, mas essa versão de `@langchain/langgraph` não aceita um schema
  Zod direto (ver seção do `graph.ts` abaixo), então essa dependência acabou não
  sendo necessária neste projeto.

---

## `langgraph.json`

```json
1  {
2    "graphs": {
3      "agent": "./src/graph/factory.ts:graph"
4    },
5    "env": ".env"
6  }
```

- **Linha 3**: diz ao LangGraph Studio "para rodar o grafo chamado `agent`, abra o
  arquivo `src/graph/factory.ts` e procure por um `export` chamado `graph`". Sem essa
  exportação existir com esse nome exato, o Studio não encontra nada para desenhar.
- **Linha 5**: carrega o `.env` antes de rodar — é assim que `LANGSMITH_API_KEY`
  chega até o processo que o Studio sobe internamente.

---

## `.env` / `.env.example`

```
1  LANGSMITH_API_KEY=cole_aqui_a_chave_que_voce_copiou_no_langsmith
2  LANGSMITH_TRACING=true
3  LANGSMITH_PROJECT=modulo02-langgraph
...
7  OPENAI_API_KEY=your-api-key-here
```

- **Linha 1 (`LANGSMITH_API_KEY`)**: autentica o projeto local com a sua conta no
  LangSmith (o painel de observabilidade do LangChain).
- **Linha 2 (`LANGSMITH_TRACING=true`)**: é essa variável que liga o envio automático
  de cada execução do grafo para o painel — sem ela (ou com `false`), o código roda
  igual, só que "no escuro" (sem visibilidade).
- **Linha 3 (`LANGSMITH_PROJECT`)**: o nome sob o qual as execuções aparecem
  agrupadas no painel do LangSmith.
- **Linha 7 (`OPENAI_API_KEY`)**: deixado como referência para uma aula futura — este
  projeto ainda **não chama nenhum modelo de IA de verdade** (o "roteamento" é feito
  só com `.includes("upper")`/`.includes("lower")`, texto puro).

---

## `src/graph/graph.ts` — o coração do grafo

```typescript
1  import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
2  import type { BaseMessage } from "@langchain/core/messages";
```

- **Linha 1**: os blocos de construção do LangGraph.
  - `StateGraph`: a classe que você instancia para começar a montar o fluxo.
  - `START` / `END`: constantes especiais (não são strings comuns) que marcam onde o
    grafo começa e termina.
  - `Annotation`: a forma nativa desta versão da lib de descrever o **formato do
    estado** — explicado em detalhe logo abaixo.
- **Linha 2**: `import type` — só o tipo `BaseMessage` (a classe-base de toda
  mensagem do LangChain: `HumanMessage`, `AIMessage`, etc.), sem gerar nenhum código
  JavaScript para esse import.

```typescript
9  // @langchain/langgraph@0.2.17 (a versão pinada pelo tutorial) ainda não tem
10 // suporte nativo a schema Zod no StateGraph — por isso o estado é definido
11 // com `Annotation.Root`, a forma nativa desta versão. [...]
14 const replace = <T>(_current: T, update: T) => update;
```

Esse comentário marca uma **divergência intencional** do tutorial. O material
original ensina a definir o estado com Zod (`z.object({...})`, passado direto para
`new StateGraph(...)`). Ao montar este projeto contra a versão realmente pinada
(`0.2.17`), essa combinação **quebra** com o erro `Invalid StateGraph input` — suporte
nativo a Zod só foi adicionado à biblioteca bem depois (a partir da série `0.2.60+`, e
mesmo assim com uma API mais verbosa). A solução foi usar `Annotation.Root`, que já
existe desde o início da `0.2.x` e representa exatamente a mesma ideia (um "molde" do
estado, com valores padrão), só com uma sintaxe diferente da do Zod.

- **Linha 14 (`replace`)**: uma função **genérica** (`<T>`) que recebe dois valores do
  mesmo tipo e devolve o segundo, ignorando o primeiro (o `_` no nome
  `_current` é uma convenção para "esse parâmetro existe só porque a assinatura
  exige, mas eu não uso ele"). Essa é a peça que, na próxima seção, faz cada campo do
  estado se comportar como "o valor mais recente escrito por um nó vence" — o mesmo
  efeito que `.default(...)` do Zod dava, sem reducer.

```typescript
16 const GraphAnnotation = Annotation.Root({
17   messages: Annotation<BaseMessage[]>({
18     reducer: replace,
19     default: () => [],
20   }),
21   output: Annotation<string>({
22     reducer: replace,
23     default: () => "",
24   }),
25   command: Annotation<"upper" | "lower" | undefined>({
26     reducer: replace,
27     default: () => undefined,
28   }),
29 });
30
31 export type GraphState = typeof GraphAnnotation.State;
```

- **Linha 16 (`Annotation.Root({...})`)**: monta o "formato do estado inteiro" — um
  objeto onde cada chave (`messages`, `output`, `command`) é um **canal** de dados que
  passa de nó em nó dentro do grafo.
- **Linha 17-20 (`messages`)**: `Annotation<BaseMessage[]>({...})` declara um canal
  cujo valor é um array de `BaseMessage`. Os dois campos dentro do objeto:
  - `reducer: replace`: toda vez que um nó devolve um novo valor para `messages`, o
    LangGraph chama essa função para decidir como **combinar** o valor antigo com o
    novo. Aqui, "combinar" é simplesmente "usar o novo e descartar o antigo" — porque
    cada nó deste projeto já devolve o array `messages` completo e atualizado (via
    spread, como você vai ver em `chatResponseNode.ts`), não precisa que o LangGraph
    faça nenhuma mesclagem por conta própria.
  - `default: () => []`: se ninguém passar `messages` na primeira chamada
    (`graph.invoke(...)`), o valor inicial é um array vazio. De novo, repare que é uma
    **função** que retorna `[]`, não o array direto — evita que diferentes execuções
    do grafo compartilhem a mesma instância de array por engano.
- **Linha 21-24 (`output`)**: mesma lógica, para um campo de texto simples que começa
  vazio (`""`).
- **Linha 25-28 (`command`)**: o tipo `"upper" | "lower" | undefined` é um **union
  type** — só pode valer uma dessas três coisas. `default: () => undefined` é o
  estado antes de `identifyIntentNode` decidir alguma coisa.
- **Linha 31**: `typeof GraphAnnotation.State` é como se extrai, a partir do objeto
  `Annotation.Root` montado acima, o **tipo TypeScript** equivalente
  (`{ messages: BaseMessage[]; output: string; command: "upper" | "lower" | undefined }`) — o mesmo papel que `z.infer<typeof GraphStateSchema>` teria com Zod,
  só que usando o mecanismo próprio do LangGraph em vez do Zod.

```typescript
33 function routeByCommand(state: GraphState): string {
34   switch (state.command) {
35     case "upper":
36       return "upperCaseNode";
37     case "lower":
38       return "lowerCaseNode";
39     default:
40       return "fallbackNode";
41   }
42 }
```

- Essa função **não é um nó do grafo** — repare que ela não devolve um `GraphState`
  inteiro, devolve uma `string`. É uma **função de roteamento**: olha o estado atual
  e decide qual é o **nome do próximo nó** a executar.
- `switch (state.command)`: examina o campo que `identifyIntentNode` preencheu.
- `case "upper"` / `case "lower"`: cada valor de `command` aponta para o nó
  correspondente — os nomes retornados (`"upperCaseNode"`, `"lowerCaseNode"`)
  precisam bater exatamente com os identificadores usados em `.addNode(...)` mais
  abaixo.
- `default: return "fallbackNode"`: cobre **tudo o que não é `"upper"` nem
  `"lower"`** — inclusive `undefined`, que é o valor padrão de `command` quando
  `identifyIntentNode` não reconhece nenhuma palavra-chave no texto.

```typescript
44 export function buildGraph() {
45   const workflow = new StateGraph(GraphAnnotation)
46     .addNode("identifyIntent", identifyIntentNode)
47     .addNode("upperCaseNode", upperCaseNode)
48     .addNode("lowerCaseNode", lowerCaseNode)
49     .addNode("fallbackNode", fallbackNode)
50     .addNode("chatResponse", chatResponseNode)
51     .addEdge(START, "identifyIntent")
52     .addConditionalEdges("identifyIntent", routeByCommand, {
53       upperCaseNode: "upperCaseNode",
54       lowerCaseNode: "lowerCaseNode",
55       fallbackNode: "fallbackNode",
56     })
57     .addEdge("upperCaseNode", "chatResponse")
58     .addEdge("lowerCaseNode", "chatResponse")
59     .addEdge("fallbackNode", "chatResponse")
60     .addEdge("chatResponse", END);
61
62   return workflow.compile();
63 }
```

- **Linha 44 (`buildGraph`)**: uma função **fábrica** — cada chamada monta um grafo
  novo do zero. Isso importa porque `server.ts` chama essa função **dentro** de
  `createServer()`, então cada instância de servidor tem seu próprio grafo, sem
  compartilhar estado entre testes.
- **Linha 45 (`new StateGraph(GraphAnnotation)`)**: instancia o grafo já com o
  "formato do estado" definido acima — é assim que o `StateGraph` sabe qual é a
  estrutura do objeto que anda entre os nós.
- **Linha 46-50 (`.addNode(...)`)**: registra cada nó com dois argumentos — uma
  **string identificadora** (usada pelas arestas para referenciar aquele nó) e a
  **função** que efetivamente executa. Todo nó **precisa** estar registrado aqui
  antes de qualquer aresta poder apontar para ele — senão o `.compile()` (linha 62)
  falha.
- **Linha 51 (`.addEdge(START, "identifyIntent")`)**: sempre que o grafo começa, o
  primeiro nó a rodar é `identifyIntent`.
- **Linha 52-56 (`.addConditionalEdges(...)`)**: recebe três argumentos.
  - `"identifyIntent"`: o nó de origem — depois que ele terminar, a decisão de rota
    entra em ação.
  - `routeByCommand`: a função definida acima, que examina o estado e devolve uma
    string.
  - `{ upperCaseNode: "upperCaseNode", ... }`: um **mapa de tradução** entre o que
    `routeByCommand` pode devolver (a chave) e o identificador real do nó no grafo (o
    valor). Aqui eles são sempre iguais de propósito, mas essa indireção existe
    porque, tecnicamente, a função de roteamento poderia devolver um código interno
    diferente do nome do nó — e é esse mapa que faria a tradução.
- **Linha 57-59**: três arestas fixas — não importa qual dos três caminhos foi
  seguido (`upper`, `lower`, ou fallback), todos **convergem** em `chatResponse`
  antes do fim. É esse padrão de "leque que se abre e converge" do diagrama no topo
  deste documento.
- **Linha 60 (`.addEdge("chatResponse", END)`)**: só depois de `chatResponse`
  formatar a resposta é que o grafo termina de verdade.
- **Linha 62 (`.compile()`)**: até aqui, `workflow` só **descreve** o grafo (quais
  nós existem, em que ordem). `.compile()` transforma essa descrição num objeto
  executável, com o método `.invoke(...)` usado em `server.ts`. Sem essa chamada, o
  LangGraph Studio também não consegue desenhar nem rodar o grafo.

---

## `src/graph/identifyIntentNode.ts` — decide o comando

```typescript
1  import type { GraphState } from "./graph.ts";
2
3  export function identifyIntentNode(state: GraphState): GraphState {
4    const lastMessage = state.messages.at(-1);
5    const input = lastMessage?.text ?? "";
6    const inputLower = input.toLowerCase();
7
8    let command: GraphState["command"];
9    if (inputLower.includes("upper")) {
10     command = "upper";
11   } else if (inputLower.includes("lower")) {
12     command = "lower";
13   }
14
15   return { ...state, command, output: input };
16 }
```

- **Linha 3**: essa é a assinatura que **todo nó** do LangGraph segue — recebe o
  estado atual, devolve o estado (igual ou atualizado). É essa forma fixa que
  permite ao `StateGraph` tratar qualquer nó da mesma maneira, não importa o que ele
  faça por dentro.
- **Linha 4 (`.at(-1)`)**: a forma moderna de pegar o **último item de um array**
  (equivalente a `array[array.length - 1]`, mas mais legível).
- **Linha 5**: dois operadores encadeados. `?.` (**optional chaining**) evita que o
  código quebre com erro caso `lastMessage` seja `undefined` (array `messages`
  vazio). `?? ""` (**nullish coalescing**) entra em ação se o resultado for `null` ou
  `undefined`, substituindo por string vazia — assim `input` nunca fica indefinido.
- **Linha 6**: normaliza para minúsculo antes de comparar, para que `"UPPER"`,
  `"Upper"` e `"upper"` sejam todos reconhecidos igual.
- **Linha 8 (`GraphState["command"]`)**: um **acesso indexado de tipo** — em vez de
  repetir `"upper" | "lower" | undefined` na mão, "pergunta" ao tipo `GraphState`
  qual é o tipo do campo `command`. Se a definição do estado mudar, esse tipo se
  ajusta sozinho.
- **Linha 9-13**: a lógica de decisão mais simples possível — só verifica se a
  substring aparece no texto, sem nenhuma IA de verdade. É proposital: o objetivo
  desta fase do curso é entender o **mecanismo de roteamento**, não construir um
  classificador de intenção sofisticado.
- Se nenhuma condição bater, `command` continua `undefined` — e é exatamente esse
  `undefined` que faz `routeByCommand` cair no caso `default` (fallback).
- **Linha 15 (`{ ...state, command, output: input }`)**: o **spread operator**
  copia todos os campos do estado atual para um objeto novo, e na sequência
  `command` e `output: input` sobrescrevem só esses dois campos. Esse padrão — nunca
  alterar o `state` recebido diretamente, sempre devolver uma cópia — é o mesmo
  princípio de imutabilidade usado em `reducers` de frontend: evita bugs sutis de um
  nó alterar um objeto que outro nó ainda está usando.

---

## `src/graph/upperCaseNode.ts` e `lowerCaseNode.ts` — transformação pura

```typescript
1  import type { GraphState } from "./graph.ts";
2
3  export function upperCaseNode(state: GraphState): GraphState {
4    return { ...state, output: state.output.toUpperCase() };
5  }
```

(`lowerCaseNode.ts` é idêntico, trocando `.toUpperCase()` por `.toLowerCase()`.)

- **Linha 4**: `state.output` já chega preenchido pelo `identifyIntentNode` (que
  copiou o texto original da mensagem para esse campo). Cada um desses nós faz **uma
  única transformação**, focada — não decide rota, não formata mensagem final, só
  transforma o texto. Essa responsabilidade única deixa fácil testar cada nó
  isoladamente (chamando a função direto com um `state` fake, sem rodar o grafo
  inteiro).
- Repare que nenhum dos dois nós mexe em `messages` — quem embrulha o resultado numa
  `AIMessage` e adiciona ao histórico é sempre o `chatResponseNode`, que roda depois.

---

## `src/graph/fallbackNode.ts` — o caminho padrão

```typescript
1  import type { GraphState } from "./graph.ts";
2
3  const FALLBACK_MESSAGE =
4    "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";
5
6  export function fallbackNode(state: GraphState): GraphState {
7    return { ...state, output: FALLBACK_MESSAGE };
8  }
```

- **Linha 3-4**: a mensagem fica numa **constante nomeada** em vez de string literal
  repetida — se precisar mudar o texto, é um lugar só, e o nome já documenta a
  intenção sem precisar de comentário.
- **Linha 7**: esta é a versão **já ajustada** do nó (o tutorial original, na
  primeira versão, também criava uma `AIMessage` aqui dentro — mas isso duplicava a
  mensagem no histórico, porque `chatResponseNode` já faz esse trabalho logo depois).
  A versão final mantém `fallbackNode` com uma única responsabilidade: decidir o
  texto de saída. Quem transforma `output` numa `AIMessage` de verdade continua
  sendo, sempre, o `chatResponseNode`.

---

## `src/graph/chatResponseNode.ts` — formata a resposta final

```typescript
1  import { AIMessage } from "@langchain/core/messages";
2  import type { GraphState } from "./graph.ts";
3
4  export function chatResponseNode(state: GraphState): GraphState {
5    const responseMessage = new AIMessage(state.output);
6
7    return {
8      ...state,
9      messages: [...state.messages, responseMessage],
10   };
11 }
```

- **Linha 1**: `AIMessage` é a classe do LangChain que representa uma mensagem
  "dita" pela IA (em contraste com `HumanMessage`, do usuário). Embrulhar o texto
  nessa classe — em vez de deixar como string solta — é o que faz o LangGraph Studio
  reconhecer e exibir a mensagem corretamente na aba de chat.
- **Linha 5**: cria a instância a partir de `state.output` — o texto que já foi
  processado por `identifyIntent` e, dependendo do caminho, por `upperCaseNode`,
  `lowerCaseNode` ou `fallbackNode`.
- **Linha 9 (`[...state.messages, responseMessage]`)**: o spread operator, agora num
  array — copia todas as mensagens já existentes e **adiciona** a nova no final, sem
  alterar o array original. Mesmo raciocínio de imutabilidade visto nos outros nós,
  aplicado a um array em vez de um objeto.
- Repare que este é o **único** nó que mexe em `messages` na versão final do grafo —
  é aqui, e só aqui, que o histórico de conversa realmente cresce.

---

## `src/graph/factory.ts` — a porta de entrada do LangGraph Studio

```typescript
1  import { buildGraph } from "./graph.ts";
2
3  export const graph = buildGraph();
```

- **Linha 3**: chama a fábrica **uma vez** e exporta o grafo já compilado com o nome
  `graph` — exatamente o nome que `langgraph.json` referencia em
  `"./src/graph/factory.ts:graph"`. Sem essa exportação com esse nome exato, o
  LangGraph Studio não encontra o grafo.

---

## `src/server.ts` — a rota HTTP `/chat`

```typescript
1  import Fastify from "fastify";
2  import { HumanMessage } from "@langchain/core/messages";
3  import { buildGraph } from "./graph/graph.ts";
4
5  export function createServer() {
6    const app = Fastify();
7    const graph = buildGraph();
8
9    app.post("/chat", async (request, reply) => {
10     const { question } = request.body as { question: string };
11
12     const response = await graph.invoke({
13       messages: [new HumanMessage(question)],
14     });
15
16     reply.send(response.output);
17   });
18
19   return app;
20 }
```

- **Linha 7**: repare que essa linha fica **fora** da rota, dentro de
  `createServer()` — o grafo é montado **uma vez** quando o servidor é criado, não a
  cada requisição. Montar de novo a cada chamada seria desperdício, já que a
  estrutura do grafo não muda entre requisições.
- **Linha 10**: extrai `question` do corpo da requisição, com uma anotação de tipo
  (`as { question: string }`) para o TypeScript saber o formato esperado — mesmo
  padrão do módulo 1. Diferente do módulo 1, aqui **não há schema de validação do
  Fastify** — se `question` vier ausente, o erro só aparece mais tarde, dentro do
  grafo (é uma simplificação proposital do tutorial nesta fase, focada no
  LangGraph, não na robustez da API).
- **Linha 12-14 (`graph.invoke(...)`)**: `invoke` é o método criado pelo
  `.compile()` — executa o grafo do `START` até o `END`. O argumento é o **estado
  inicial**: só o campo `messages` é passado explicitamente; `output` e `command`
  não precisam ser informados porque `Annotation.Root` já define `default(...)` para
  eles (ver `graph.ts`). `invoke` é `async` porque, quando um nó chamar de verdade um
  modelo de IA (fora do escopo desta aula), isso vai envolver uma requisição de
  rede.
- **Linha 13 (`new HumanMessage(question)`)**: embrulha o texto do usuário na classe
  correta — é assim que o LangChain sabe, dentro do grafo, "quem" disse esse texto.
- **Linha 16 (`reply.send(response.output)`)**: `graph.invoke(...)` devolve o
  **estado final**, depois de passar por todos os nós até `END`. Só o campo
  `output` é enviado como resposta — não o objeto de estado inteiro.

---

## `src/index.ts` — o ponto de entrada

```typescript
1  import { createServer } from "./server.ts";
2
3  const app = createServer();
4  await app.listen({ port: 3000, host: "localhost" });
```

- **Linha 4**: `top-level await` — desde uma versão recente do Node, é permitido
  usar `await` no nível mais alto de um módulo, sem precisar envolver isso numa
  função `async` separada.

---

## `tests/graph.test.ts` — os três caminhos do grafo

```typescript
1  import { test } from "node:test";
2  import assert from "node:assert";
3  import { createServer } from "../src/server.ts";
4
5  test("command upper - transforma a mensagem em upper case", async () => {
6    const app = createServer();
7
8    const response = await app.inject({
9      method: "POST",
10     url: "/chat",
11     payload: { question: "make this message upper please" },
12   });
13
14   const expected = "MAKE THIS MESSAGE UPPER PLEASE";
15   assert.deepEqual(response.body, expected);
16 });
```

- **Linha 1-2**: `node:test` e `node:assert` são módulos **embutidos** no Node — não
  precisa instalar nenhuma biblioteca de testes externa.
- **Linha 6**: cria um servidor (e, por dentro, um grafo) **novo e isolado** para
  cada teste — nenhum teste interfere no estado de outro.
- **Linha 8-12 (`app.inject`)**: simula uma requisição HTTP sem abrir uma porta de
  rede de verdade — passa pelo mesmo roteamento e handler que uma requisição real
  passaria, só mais rápido. `payload` é um **apelido** aceito pelo Fastify para o
  campo `body` — os dois funcionam igual.
- **Linha 11**: a palavra `"upper"` dentro da frase é o gatilho que
  `identifyIntentNode` procura para decidir `command: "upper"`.
- **Linha 14**: a frase inteira em maiúsculo — o teste valida que **a frase
  inteira** é transformada, não só a palavra "upper".
- **Linha 15 (`assert.deepEqual`)**: compara o corpo da resposta com o texto
  esperado. Como `reply.send(response.output)` (em `server.ts`) manda uma string
  simples (não um JSON), `response.body` já chega como a string pronta — não precisa
  de `.json()` aqui, diferente do projeto do módulo 1.

Os outros dois testes (`command lower`, linha 18-29, e `comando desconhecido`, linha
31-43) seguem exatamente a mesma estrutura, só trocando a pergunta enviada e o texto
esperado — cobrindo, respectivamente, o caminho `lowerCaseNode` e o caminho
`fallbackNode`.

---

## Duas decisões de projeto que fogem do tutorial original

### 1. `Annotation.Root` no lugar de Zod

O tutorial (aula 2) ensina a definir o estado do grafo com `z.object({...})` do Zod,
passado direto para `new StateGraph(...)`. Testando contra a versão realmente pinada
(`@langchain/langgraph@0.2.17`), essa combinação **não funciona** — dá erro
`Invalid StateGraph input`, porque suporte nativo a Zod só foi adicionado à
biblioteca bem depois (a partir de versões `0.2.60+` da série `0.2.x`, e mesmo assim
com uma API mais verbosa, via uma função `withLangGraph()` por campo). A solução foi
usar `Annotation.Root`, a forma **nativa** desta versão pinada — mesma ideia (um
molde do estado, com valores padrão por campo), sintaxe diferente. Nenhuma lógica de
nó precisou mudar por causa disso.

### 2. Vulnerabilidades conhecidas mantidas de propósito

`npm audit` acusa 9 vulnerabilidades (6 altas) nas dependências transitivas de
`langchain@0.1.19` (SQL injection em loaders de dados não usados aqui, SSRF em
carregadores de URL não usados, extração de secrets via serialização, prototype
pollution). O único fix automático levaria para `langchain@1.5.3` — uma reescrita de
API completa, incompatível com o que o tutorial ensina (`StateGraph`,
`addConditionalEdges`, etc. têm formato diferente na v1). Como este é um projeto de
estudo local, sem exposição a input não confiável de fontes externas, a decisão foi
manter as versões pinadas pelo tutorial.

## Verifique seu entendimento

1. Por que `replace` (em `graph.ts`) ignora o primeiro argumento e sempre devolve o
   segundo? Que efeito isso tem no campo `messages` quando um nó devolve o array
   inteiro via spread?
2. Qual a diferença entre um **nó** (`identifyIntentNode`) e a **função de
   roteamento** (`routeByCommand`), em termos do que cada um recebe e do que cada um
   devolve?
3. Por que `fallbackNode` não cria mais uma `AIMessage` na versão final, se
   `chatResponseNode` só roda depois dele na cadeia?
4. Em `tests/graph.test.ts`, por que `assert.deepEqual(response.body, expected)`
   funciona sem chamar `.json()` primeiro, diferente do projeto do módulo 1?
5. O que aconteceria, no `routeByCommand`, se `addConditionalEdges` não tivesse a
   entrada `fallbackNode: "fallbackNode"` no seu mapa de tradução?
