---
title: "Tutorial: definindo o estado do grafo e o primeiro node"
modulo: 2
aula: 2
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, state-graph, zod, fastify]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/02-gerenciando-estados-em.md
---
# Tutorial: definindo o estado do grafo e o primeiro node

> Continuação prática de [O estado do grafo: a ficha que passa de nó em nó](02-artigo-estado-e-primeiro-node.md).
> Antes desse tutorial, veja o [tutorial de configuração inicial](01-tutorial-configurando-langchain-langgraph.md) (criar chave do LangSmith, iniciar o projeto, etc.).
>
> Este tutorial explica **cada trecho de código linha a linha** — a ideia não é só copiar e colar, mas entender o porquê de cada decisão antes de seguir para a próxima aula.

## O que você vai construir

O esqueleto mínimo de um grafo do LangGraph: o formato do estado (usando Zod), um primeiro nó que ainda não faz nada de útil, e essa estrutura exposta como uma rota HTTP com Fastify. Ainda sem transformação de texto de verdade — isso vem na [próxima aula](03-tutorial-nodes-e-edges-lineares.md).

## Passo 0 — Limpar o projeto herdado do módulo anterior

Se você já fez o [tutorial de configuração inicial](01-tutorial-configurando-langchain-langgraph.md), seu projeto `02-langchain` já tem `.env`, `tsconfig.json`, `langgraph.json` e as dependências instaladas.

Do projeto do módulo 1 (a API com Fastify), reaproveite apenas:

- o arquivo de entrada (`src/index.ts`);
- o arquivo de inicialização do servidor (`src/server.ts`);
- o script `dev` do `package.json`.

Remova qualquer service específico de outra integração (ex.: um `openrouter-service.ts`) e deixe só **um teste simples**, garantindo que a estrutura básica ainda funciona:

```ts
// tests/server.test.ts
import { test } from "node:test";
import assert from "node:assert";
import { createServer } from "../src/server.ts";

test("a API sobe e responde", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    body: { question: "teste" },
  });

  assert.strictEqual(response.statusCode, 200);
});
```

Linha a linha:

- `import { test } from "node:test"` e `import assert from "node:assert"`: os dois módulos nativos do Node que dão o test runner e as asserções — nenhuma dependência externa é instalada só para testar.
- `createServer()`: a fábrica do servidor Fastify, reaproveitada do módulo anterior.
- `app.inject({...})`: simula uma requisição HTTP real sem abrir uma porta de rede de verdade — mais rápido para rodar em testes automatizados.
- `assert.strictEqual(response.statusCode, 200)`: por enquanto o único critério de sucesso é "a rota responde sem quebrar" — ainda não valida o conteúdo, porque a rota nem está processando nada de verdade ainda.

> **Dica prática (TypeScript + ESM):** se ao rodar os testes você receber um erro relacionado a `import`, confira se o `package.json` tem `"type": "module"`. Mesmo usando TypeScript, o Node precisa saber que o projeto trabalha com módulos ES.

Rode os testes a partir da raiz do projeto (`02-langchain`, não de dentro de nenhuma subpasta):

```bash
npm run test:dev
```

Se o VS Code tiver um terminal de debug JavaScript configurado (menu **Run and Debug** → **JavaScript Debug Terminal**), rodar o comando ali já deixa o depurador conectado automaticamente — útil para investigar falhas nos próximos passos, em vez de espalhar `console.log` pelo código.

## Passo 1 — Criar a pasta do grafo

Dentro de `src`, crie uma pasta `graph`. Nessa aula, ela vai ter dois arquivos:

- `graph.ts` — a definição do estado e a função que monta o grafo (`buildGraph`).
- `factory.ts` — o arquivo que exporta a instância `graph` que o LangGraph Studio precisa encontrar (é o caminho `./src/graph/factory.ts:graph` que o `langgraph.json` do tutorial anterior aponta).

## Passo 2 — Instalar o Zod na versão certa

```bash
npm install zod@3
```

A versão `3` é usada de propósito aqui, não é um acidente: no momento da aula, o LangChain `1.x` tinha um bug conhecido que impedia a aba de chat do LangGraph Studio de funcionar com a versão mais recente do Zod. Fixar `zod@3` é o contorno encontrado numa *issue* do GitHub do projeto.

## Passo 3 — Definir o formato do estado

```ts
// src/graph/graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod"; // zod@3
import type { BaseMessage } from "@langchain/core/messages";

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  output: z.string().default(""),
  command: z.enum(["upper", "lower"]).optional(),
});

export type GraphState = z.infer<typeof GraphStateSchema>;
```

Linha a linha:

- `import { StateGraph, START, END } from "@langchain/langgraph"`: os três blocos de construção do grafo. `StateGraph` é a classe que você instancia para começar a montar o fluxo; `START` e `END` são constantes especiais (não strings comuns) que marcam onde o grafo começa e termina.
- `import { z } from "zod"`: o `z` é o ponto de entrada de toda a API do Zod — é a partir dele que você chama `z.object`, `z.string`, `z.enum`, etc. O comentário `// zod@3` fica como lembrete de que essa versão importa (não é decorativo).
- `import type { BaseMessage }`: `import type` (em vez de `import` normal) diz ao TypeScript "eu só preciso disso para checagem de tipos, não gera nenhum código JavaScript de verdade para esse import" — deixa o bundle mais enxuto e deixa claro, para quem lê o código, que `BaseMessage` é usado só como tipo.
- `const GraphStateSchema = z.object({ ... })`: `z.object` descreve um formato de objeto — cada chave dentro dele vira um campo obrigatório (a não ser que você marque como `.optional()`).
  - `messages: z.custom<BaseMessage[]>().default(() => [])`: `z.custom<T>()` é usado quando você quer validar contra um tipo do TypeScript que o Zod não tem como checar em tempo de execução (nesse caso, um array de `BaseMessage`, uma classe complexa do LangChain) — ele só "confia" no tipo, sem validação real de estrutura. `.default(() => [])` diz: se ninguém passar `messages` ao criar o estado inicial, comece com um array vazio. Repare que o default é uma **função** que retorna `[]`, não o array `[]` direto — isso evita que todas as execuções do grafo compartilhem a *mesma instância* de array por referência (um erro clássico em JavaScript ao usar valores mutáveis como default).
  - `output: z.string().default("")`: um campo de texto simples, que começa vazio.
  - `command: z.enum(["upper", "lower"]).optional()`: `z.enum([...])` restringe o valor a **apenas** essas duas strings — se algum código tentar colocar `"invalido"` aí, o TypeScript já acusa erro de tipo antes mesmo de rodar. `.optional()` permite que o campo comece como `undefined` (é exatamente o estado antes de `identifyIntent` decidir alguma coisa, o que só acontece na próxima aula).
- `export type GraphState = z.infer<typeof GraphStateSchema>`: `z.infer<typeof X>` é um recurso do Zod que **deriva um tipo do TypeScript a partir do schema**, em vez de você escrever o tipo à mão duas vezes (uma para validação, outra para tipagem). Ou seja, `GraphState` vira automaticamente `{ messages: BaseMessage[]; output: string; command?: "upper" | "lower" }` — e se você mudar o schema depois, o tipo se atualiza sozinho.

## Passo 4 — O primeiro node: um placeholder que só repassa o estado

```ts
// src/graph/identifyIntentNode.ts
import type { GraphState } from "./graph.ts";

export function identifyIntentNode(state: GraphState): GraphState {
  return state;
}
```

Linha a linha:

- `import type { GraphState } from "./graph.ts"`: só o tipo é necessário aqui. Repare que o import termina em `.ts`: como o projeto roda TypeScript nativo do Node (sem transpilador), o caminho do import precisa ser o caminho real do arquivo.
- `export function identifyIntentNode(state: GraphState): GraphState`: a assinatura que **todo nó** do LangGraph segue — recebe o estado atual, devolve o estado (igual ou atualizado). É essa assinatura fixa que permite ao `StateGraph` tratar qualquer nó da mesma forma, não importa o que ele faça por dentro.
- `return state`: por enquanto, devolve exatamente o mesmo estado recebido, sem alterar nada. É um placeholder — o objetivo aqui é só confirmar que o "fio" entre `START`, esse nó e `END` está montado corretamente antes de colocar lógica de verdade (isso vem na próxima aula).

## Passo 5 — Montar o grafo linear

```ts
// src/graph/graph.ts (continuação)
import { identifyIntentNode } from "./identifyIntentNode.ts";

export function buildGraph() {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", identifyIntentNode)
    .addEdge(START, "identifyIntent")
    .addEdge("identifyIntent", END);

  return workflow.compile();
}
```

Linha a linha:

- `export function buildGraph()`: uma função **fábrica** — cada chamada monta um grafo novo. Isso importa para os testes: cada `createServer()` pode criar sua própria instância de grafo, sem um teste "vazar" estado para o outro.
- `new StateGraph(GraphStateSchema)`: instancia o grafo passando o schema do Zod definido no Passo 3 — é assim que o `StateGraph` sabe qual é o formato do "objeto que anda entre os nós".
- `.addNode("identifyIntent", identifyIntentNode)`: registra um nó com dois argumentos — uma **string identificadora** (`"identifyIntent"`, usada nas arestas para referenciar esse nó) e a **função** que efetivamente executa. Repare que o nome do nó e o nome da função podem, tecnicamente, ser diferentes — mas manter os dois iguais (como aqui) deixa o código mais fácil de rastrear.
- `.addEdge(START, "identifyIntent")`: sempre que o grafo começar (`START`), o primeiro (e único, por enquanto) nó a rodar é `"identifyIntent"`.
- `.addEdge("identifyIntent", END)`: depois que `identifyIntent` terminar, o grafo já termina — ainda não existe nenhuma ramificação nem nó seguinte.
- Cada chamada `.addNode()`/`.addEdge()` **devolve o próprio `workflow`** — é por isso que dá para encadear todas essas chamadas com `.` sem precisar de uma variável intermediária a cada linha (o padrão chamado *method chaining*, o mesmo estilo usado em bibliotecas como o Fastify).
- `return workflow.compile()`: até aqui, `workflow` só **descreve** o grafo (quais nós existem, em que ordem). `.compile()` é o passo que transforma essa descrição num objeto executável, com o método `.invoke(...)` que você vai usar na API a seguir. Sem chamar `.compile()`, o LangGraph Studio também não consegue desenhar nem rodar o grafo.

## Passo 6 — Exportar o grafo para o LangGraph Studio

```ts
// src/graph/factory.ts
import { buildGraph } from "./graph.ts";

export const graph = buildGraph();
```

Linha a linha:

- `import { buildGraph } from "./graph.ts"`: importa a fábrica criada no Passo 5.
- `export const graph = buildGraph()`: chama a fábrica **uma vez** e exporta o resultado já compilado com o nome `graph` — é exatamente esse nome que o `langgraph.json` (visto no tutorial anterior) referencia em `"./src/graph/factory.ts:graph"`. Sem essa exportação com esse nome exato, o LangGraph Studio não encontra o grafo e a interface não abre corretamente.

## Passo 7 — Ligar o grafo na rota HTTP

```ts
// src/server.ts (trecho relevante)
import Fastify from "fastify";
import { HumanMessage } from "@langchain/core/messages";
import { buildGraph } from "./graph/graph.ts";

export function createServer() {
  const app = Fastify();
  const graph = buildGraph();

  app.post("/chat", async (request, reply) => {
    const { question } = request.body as { question: string };

    const response = await graph.invoke({
      messages: [new HumanMessage(question)],
    });

    reply.send(response.output);
  });

  return app;
}
```

Linha a linha:

- `const graph = buildGraph()`: repare que essa linha fica **fora** da rota, dentro de `createServer()` — o grafo é montado **uma vez** quando o servidor é criado, não a cada requisição. Montar de novo a cada chamada seria desperdício de trabalho, já que a estrutura do grafo não muda entre requisições.
- `const { question } = request.body as { question: string }`: extrai o campo `question` do corpo da requisição, com uma anotação de tipo (`as { question: string }`) para o TypeScript saber o formato esperado — o mesmo padrão já usado nas rotas do módulo anterior.
- `await graph.invoke({ messages: [new HumanMessage(question)] })`: `invoke` é o método (criado pelo `.compile()` do Passo 5) que efetivamente **executa** o grafo do `START` até o `END`. O argumento é o **estado inicial** — repare que só o campo `messages` é passado explicitamente; os campos `output` e `command` não precisam ser informados porque o schema do Zod (Passo 3) já define valores `.default(...)` para eles. `invoke` é `async` porque, mais pra frente (quando um nó chamar de verdade um modelo de IA), essa chamada vai envolver uma requisição de rede — por isso o `await` já está preparado desde já.
- `new HumanMessage(question)`: embrulha o texto do usuário na classe correta — é assim que o LangChain sabe, dentro do grafo, "quem" disse esse texto (o usuário, e não o sistema ou a própria IA).
- `reply.send(response.output)`: `graph.invoke(...)` devolve o **estado final** depois de passar por todos os nós até o `END`. Nesse ponto da aula, `response.output` ainda sai vazio (`""`), porque nenhum nó preencheu esse campo ainda — o `identifyIntentNode` só devolve o estado como recebeu. Isso é esperado: essa aula só valida a **fiação** do grafo, não a lógica.

## Passo 8 — Rodar e conferir no LangGraph Studio

```bash
npm run dev
```

Abra o LangGraph Studio (o comando visto no tutorial anterior) e confira: o grafo desenhado deve mostrar `START → identifyIntent → END`. Digite qualquer coisa no chat — a resposta ainda não vem preenchida, mas você já consegue clicar no nó `identifyIntent` na trilha de execução e ver o `state` (JSON) circulando entre `START` e `END`.

## Onde isso te deixa

Você tem o esqueleto mínimo de um grafo funcionando: um estado tipado com Zod, um nó (mesmo que ainda vazio) e uma rota HTTP que já invoca esse grafo de ponta a ponta. Na [próxima aula](03-tutorial-nodes-e-edges-lineares.md), o `identifyIntentNode` ganha lógica de verdade e aparece um segundo nó, `chatResponse`, que formata a resposta final.

## Verifique seu entendimento

1. Por que `messages` usa `.default(() => [])` em vez de `.default([])`?
2. O que `z.infer<typeof GraphStateSchema>` evita que você tivesse que fazer manualmente?
3. Qual a diferença entre o que `workflow` representa antes e depois de chamar `.compile()`?
4. Por que o nome exportado em `factory.ts` precisa ser exatamente `graph`?
