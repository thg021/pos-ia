---
title: "Tutorial: recomendador de música com preferências e memória persistente"
modulo: 4
aula: [1, 2, 3, 4]
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [memoria, langgraph, postgres, sqlite, resumo-de-contexto, typescript]
fonte: docs/scrap/platos-legendas/output/curso-14082629/04-modulo-04/
---

# Tutorial: recomendador de música com preferências e memória persistente

Este tutorial constrói um assistente de recomendação musical (via linha de comando) que extrai preferências do cliente durante a conversa, guarda o histórico de mensagens em Postgres, guarda as preferências em SQLite, e resume a conversa automaticamente quando ela cresce demais.

## Passo 0 — Infraestrutura

O projeto precisa de um Postgres rodando (via Docker) para o histórico de mensagens, e usa SQLite (em arquivo local) para as preferências:

```bash
npm install @langchain/langgraph-checkpoint-postgres pg
npm install better-sqlite3 knex  # knex como query builder simples, não um ORM completo
docker compose up -d
```

## Passo 1 — Estado do grafo

```typescript
// src/graph/graph.ts
import { z } from "zod";

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  userId: z.string().optional(),
  userContext: z.string().optional(),
  extractedPreferences: z
    .object({
      name: z.string().optional(),
      age: z.number().optional(),
      genres: z.array(z.string()).optional(),
      bands: z.array(z.string()).optional(),
    })
    .optional(),
  shouldSavePreferences: z.boolean().optional(),
  conversationSummary: z.string().optional(),
  needsSummarization: z.boolean().optional(),
});

export type GraphState = z.infer<typeof GraphStateSchema>;
```

## Passo 2 — O serviço de memória (checkpoint + store no Postgres)

```typescript
// src/services/memoryService.ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

export type MemoryService = {
  checkpointer: PostgresSaver;
  store: PostgresStore;
};

export async function createMemoryService(connectionString: string): Promise<MemoryService> {
  const store = PostgresStore.fromConnString(connectionString);
  const checkpointer = PostgresSaver.fromConnString(connectionString);

  await store.setup();
  await checkpointer.setup();

  console.log("memória configurada");
  return { checkpointer, store };
}
```

`checkpointer` guarda o estado do grafo por *thread* (permitindo retomar uma conversa exatamente de onde parou); `store` é usado para dados que precisam sobreviver entre threads diferentes do mesmo usuário. Ambos apontam para o mesmo Postgres, mas cumprem papéis distintos dentro do LangGraph.

## Passo 3 — O serviço de preferências (SQLite)

```typescript
// src/services/preferencesService.ts
import knex, { type Knex } from "knex";

export class PreferencesService {
  private db: Knex;

  constructor(dbPath: string) {
    this.db = knex({ client: "better-sqlite3", connection: { filename: dbPath }, useNullAsDefault: true });
  }

  async getBasicInfo(userId: string) {
    return this.db("user_preferences").where({ user_id: userId }).first();
  }

  async mergePreferences(userId: string, newData: Record<string, unknown>) {
    const existing = await this.getBasicInfo(userId);
    const merged = { ...existing, ...newData, user_id: userId, updated_at: new Date().toISOString() };

    await this.db("user_preferences")
      .insert(merged)
      .onConflict("user_id")
      .merge();
  }

  async storeSummary(userId: string, summary: string) {
    await this.db("user_preferences")
      .where({ user_id: userId })
      .update({ conversation_summary: summary });
  }
}
```

O ponto-chave de `mergePreferences`: ele **mescla** o que já existia com o dado novo, em vez de sobrescrever tudo — assim, se o cliente já tinha dito o nome numa conversa anterior e agora só menciona uma banda nova, o nome não se perde.

## Passo 4 — Ligando tudo na factory

```typescript
// src/graph/factory.ts
export async function buildAppGraph() {
  const memoryService = await createMemoryService(config.memoryDbUrl);
  const preferencesService = new PreferencesService(config.preferencesDbPath);
  const llmClient = new OpenRouterService();

  const graph = buildGraph(llmClient, preferencesService);

  return graph.compile({
    checkpointer: memoryService.checkpointer,
    store: memoryService.store,
  });
}
```

## Passo 5 — O nó `chatNode`: montar o histórico como texto e chamar a IA

```typescript
// src/graph/chatNode.ts
import { HumanMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import type { PreferencesService } from "../services/preferencesService.ts";
import { getSystemPrompt, getUserPromptTemplate } from "./prompts/chatPrompts.ts";

export function createChatNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  return async function chatNode(state: GraphState, runtime: { context?: { userId?: string } }) {
    const userId = runtime.context?.userId ?? state.userId ?? "anonimo";

    let userContext = state.userContext;
    if (!userContext) {
      const basicInfo = await preferencesService.getBasicInfo(userId);
      userContext = basicInfo ? JSON.stringify(basicInfo) : "";
    }

    const conversationHistory = state.messages
      .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.content}`)
      .join("\n");

    const lastUserMessage = state.messages.at(-1)?.content ?? "";

    const systemPrompt = getSystemPrompt(userContext);
    const userPrompt = getUserPromptTemplate({ message: lastUserMessage, conversationHistory });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, ChatResponseSchema);

    if (!result.success) {
      console.error("erro no chatNode", result.error);
      return { messages: [...state.messages, new AIMessage("Desculpe, encontrei um erro. Pode tentar novamente?")] };
    }

    return {
      messages: [...state.messages, new AIMessage(result.data.message)],
      extractedPreferences: result.data.shouldSavePreferences ? result.data.preferences : undefined,
      needsSummarization: state.messages.length > config.maxMessagesToSummarize,
    };
  };
}
```

Pontos importantes:
- O histórico é transformado em uma string simples (`"user: ..."` / `"assistant: ..."`) para caber no prompt — essa é a representação que "engorda" com o tempo, e é exatamente o que o passo de resumo (mais adiante) vai controlar.
- `userContext` só é buscado no banco se ainda não estiver no estado — evitando uma consulta redundante a cada mensagem da mesma conversa.
- `needsSummarization` é calculado comparando o tamanho atual do histórico com um limite configurável (`config.maxMessagesToSummarize`) — na aula, um valor propositalmente baixo (6) foi usado só para conseguir observar o resumo acontecendo rapidamente durante o desenvolvimento; em produção esse número tende a ser bem maior.

## Passo 6 — O nó `savePreferencesNode`

```typescript
// src/graph/savePreferencesNode.ts
export function createSavePreferencesNode(preferencesService: PreferencesService) {
  return async function savePreferencesNode(state: GraphState, runtime: { context?: { userId?: string } }) {
    if (!state.extractedPreferences) {
      return {};
    }

    const userId = String(runtime.context?.userId ?? state.userId ?? "desconhecido");
    await preferencesService.mergePreferences(userId, state.extractedPreferences);

    return { extractedPreferences: undefined };
  };
}
```

Depois de persistir, o campo `extractedPreferences` é limpo do estado (`undefined`) — ele já cumpriu seu papel e não precisa continuar sendo carregado adiante.

## Passo 7 — Roteamento condicional: salvar preferências e/ou resumir

```typescript
function routeAfterChat(state: GraphState): string {
  if (state.extractedPreferences) return "savePreferencesNode";
  if (state.needsSummarization) return "summarizeNode";
  return END;
}

function routeAfterSavePreferences(state: GraphState): string {
  return state.needsSummarization ? "summarizeNode" : END;
}
```

## Passo 8 — O nó de resumo (`summarizeNode`)

```typescript
// src/graph/summarizeNode.ts
export function createSummarizeNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  return async function summarizeNode(state: GraphState, runtime: { context?: { userId?: string } }) {
    const conversationHistory = state.messages
      .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.content}`)
      .join("\n");

    const previousSummary = state.conversationSummary;
    const systemPrompt = getSummarizationSystemPrompt();
    const userPrompt = getSummarizationUserPrompt({ conversationHistory, previousSummary });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SummarySchema);

    if (!result.success) {
      return { needsSummarization: false };
    }

    const userId = String(runtime.context?.userId ?? state.userId ?? "desconhecido");
    await preferencesService.storeSummary(userId, result.data.summary);

    // mantém só as 2 mensagens mais recentes (última pergunta + última resposta),
    // removendo o resto do histórico que já foi condensado no resumo
    const messagesToRemove = state.messages.slice(0, -2).map((msg) => new RemoveMessage({ id: msg.id! }));

    return {
      messages: messagesToRemove,
      conversationSummary: result.data.summary,
      needsSummarization: false,
    };
  };
}
```

O detalhe mais importante aqui é `RemoveMessage`: é um tipo especial do LangGraph que, quando incluído no retorno de um nó, instrui o *reducer* de mensagens a **remover** aquela mensagem específica do estado acumulado (em vez de adicionar mais uma, que é o comportamento padrão). É assim que o histórico é "podado" depois de resumido, mantendo só as últimas trocas junto com o resumo consolidado.

## Passo 9 — Montando o grafo completo

```typescript
export function buildGraph(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("chatNode", createChatNode(llmClient, preferencesService))
    .addNode("savePreferencesNode", createSavePreferencesNode(preferencesService))
    .addNode("summarizeNode", createSummarizeNode(llmClient, preferencesService))
    .addEdge(START, "chatNode")
    .addConditionalEdges("chatNode", routeAfterChat, {
      savePreferencesNode: "savePreferencesNode",
      summarizeNode: "summarizeNode",
      [END]: END,
    })
    .addConditionalEdges("savePreferencesNode", routeAfterSavePreferences, {
      summarizeNode: "summarizeNode",
      [END]: END,
    })
    .addEdge("summarizeNode", END);

  return workflow.compile();
}
```

## Passo 10 — Testando via linha de comando

Diferente dos módulos anteriores (que expunham uma rota HTTP), este projeto roda como um script de linha de comando para facilitar observar a conversa evoluindo:

```bash
npm run chat -- --user=eric-wendel
```

Converse normalmente, mencionando nome, idade, bandas e gêneros favoritos aos poucos. Depois de encerrar (`Ctrl+C`) e rodar o comando de novo com o mesmo `--user`, o assistente deve recuperar as preferências salvas e continuar de onde parou — prova de que a memória de longo prazo está funcionando.

Para observar o resumo acontecendo, force um histórico curto no `config` (ex: `maxMessagesToSummarize: 2`) durante o desenvolvimento, e envie algumas mensagens seguidas — você deve ver, nos logs, o momento em que o histórico é condensado num resumo e as mensagens antigas são removidas do estado.

## Onde isso te deixa

Você tem agora um agente que: mantém histórico de conversa persistente (Postgres + checkpoints), extrai e atualiza preferências de cada cliente automaticamente (SQLite), e gerencia o tamanho do contexto resumindo o histórico de forma incremental — os três pilares de qualquer aplicação de chat que precisa escalar além de uma conversa curta e descartável.

## Verifique seu entendimento

1. Por que o projeto usa `checkpointer` e `store` como dois objetos separados, mesmo apontando para o mesmo banco de dados?
2. O que `mergePreferences` faz de diferente de simplesmente sobrescrever o registro do usuário no banco?
3. Para que serve o tipo especial `RemoveMessage`, e por que ele é necessário para "podar" o histórico depois de um resumo?
4. Se você aumentasse `maxMessagesToSummarize` de 6 para 200, que trade-off isso implicaria em termos de custo de tokens vs. frequência de resumo?
