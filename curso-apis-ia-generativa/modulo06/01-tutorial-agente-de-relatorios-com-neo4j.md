---
title: "Tutorial: agente de relatórios com Neo4j, multi-step e auto-correção"
modulo: 6
aula: [1, 2, 3, 4, 5]
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [neo4j, cypher, langgraph, typescript, retry, multi-step]
fonte: docs/scrap/platos-legendas/output/curso-14082629/06-modulo-06/
---

# Tutorial: agente de relatórios com Neo4j, multi-step e auto-correção

Este tutorial constrói um agente que responde perguntas de negócio em linguagem natural, gerando e executando queries Cypher contra um banco Neo4j, com decomposição de perguntas complexas e auto-correção de queries inválidas.

## Passo 0 — Infraestrutura

```bash
docker compose up -d   # sobe o Neo4j local
npm install neo4j-driver
```

## Passo 1 — Estado do grafo

```typescript
// src/graph/graph.ts
import { z } from "zod";

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  question: z.string().optional(),
  isMultiStep: z.boolean().default(false),
  subQuestions: z.array(z.string()).default([]),
  currentStep: z.number().optional(),
  query: z.string().optional(),
  originalQuery: z.string().optional(),
  subQueries: z.array(z.string()).default([]),
  subResults: z.array(z.unknown()).default([]),
  dbResults: z.unknown().optional(),
  needsCorrection: z.boolean().default(false),
  validationError: z.string().optional(),
  correctionAttempts: z.number().default(0),
  error: z.string().optional(),
  answer: z.string().optional(),
  followUpQuestions: z.array(z.string()).default([]),
});

export type GraphState = z.infer<typeof GraphStateSchema>;
```

## Passo 2 — O serviço Neo4j

```typescript
// src/services/neo4jService.ts
import neo4j, { type Driver } from "neo4j-driver";

export class Neo4jService {
  private driver: Driver;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  async getSchema(): Promise<string> {
    const session = this.driver.session();
    try {
      const result = await session.run("CALL db.schema.visualization()");
      return JSON.stringify(result.records);
    } finally {
      await session.close();
    }
  }

  async validateQuery(query: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      await session.run(`EXPLAIN ${query}`);
      return true;
    } catch {
      return false;
    } finally {
      await session.close();
    }
  }

  async query(cypherQuery: string): Promise<unknown[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(cypherQuery);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
```

O prefixo `EXPLAIN` antes da query é o que permite **validar a sintaxe sem executar de fato** — o Neo4j monta o plano de execução e retorna erro se a query for inválida, sem tocar nos dados.

## Passo 3 — O query planner: decidir se decompõe a pergunta

```typescript
// src/graph/queryPlannerNode.ts
import { z } from "zod";

const QueryAnalysisSchema = z.object({
  complexity: z.enum(["simple", "complex"]),
  needsDecomposition: z.boolean(),
  subQuestions: z.array(z.string()).optional(),
  reasoning: z.string(),
});

export function createQueryPlannerNode(llmClient: OpenRouterService) {
  return async function queryPlannerNode(state: GraphState): Promise<Partial<GraphState>> {
    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(state.question!);

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, QueryAnalysisSchema);

    if (!result.success) {
      // fallback seguro: assume caso simples, evita travar o fluxo por erro externo
      return { isMultiStep: false };
    }

    const needsDecomposition = Boolean(result.data.needsDecomposition && result.data.subQuestions?.length);

    return {
      isMultiStep: needsDecomposition,
      subQuestions: needsDecomposition ? result.data.subQuestions : [],
      currentStep: 0,
      subQueries: [],
      subResults: [],
    };
  };
}
```

Repare no fallback explícito para `isMultiStep: false` em caso de erro — se a análise de complexidade falhar, o sistema prefere tentar responder com uma única query simples a travar o fluxo inteiro.

## Passo 4 — Determinando qual pergunta processar em cada passo

```typescript
// src/graph/utils/getCurrentStepQuestion.ts
export function getCurrentStepQuestion(state: GraphState): string | null {
  if (!state.isMultiStep || !state.subQuestions.length) {
    return state.currentStep === undefined ? state.question ?? null : null;
  }

  if ((state.currentStep ?? 0) >= state.subQuestions.length) {
    return null; // todos os passos já foram processados
  }

  return state.subQuestions[state.currentStep ?? 0];
}
```

## Passo 5 — O cypher generator

```typescript
// src/graph/cypherGeneratorNode.ts
import { z } from "zod";

const CypherQuerySchema = z.object({ query: z.string() });

export function createCypherGeneratorNode(llmClient: OpenRouterService, neo4jService: Neo4jService) {
  return async function cypherGeneratorNode(state: GraphState): Promise<Partial<GraphState>> {
    const targetQuestion = getCurrentStepQuestion(state) ?? state.question!;
    const schema = await neo4jService.getSchema();

    const systemPrompt = getSystemPrompt({ schema, businessContext: getSalesBusinessContext() });
    const userPrompt = getUserPrompt(targetQuestion);

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, CypherQuerySchema);

    if (!result.success) {
      return { error: "falha ao gerar query" };
    }

    if (state.isMultiStep && state.subQueries.length < state.subQuestions.length) {
      const updatedSubQueries = [...state.subQueries];
      updatedSubQueries[state.currentStep ?? 0] = result.data.query;
      return { subQueries: updatedSubQueries, query: result.data.query };
    }

    return { query: result.data.query };
  };
}
```

O `businessContext` injetado no prompt (regras de negócio como "um aluno só pode ter progresso em cursos que comprou", "status pode ser paid/refunded") é o que ajuda o modelo a gerar queries semanticamente corretas, não só sintaticamente válidas.

## Passo 6 — O cypher executor: validar, executar e decidir o próximo passo

```typescript
// src/graph/cypherExecutorNode.ts
async function executeQuery(query: string, neo4jService: Neo4jService) {
  const isValid = await neo4jService.validateQuery(query);
  if (!isValid) {
    return { results: null, error: "falha na validação de sintaxe" };
  }

  const results = await neo4jService.query(query);
  if (!results.length) {
    return { results: [], error: null };
  }

  return { results, error: null };
}

export function createCypherExecutorNode(neo4jService: Neo4jService) {
  return async function cypherExecutorNode(state: GraphState): Promise<Partial<GraphState>> {
    const { results, error } = await executeQuery(state.query!, neo4jService);

    if (error && results === null) {
      const attempts = state.correctionAttempts ?? 0;
      if (attempts < config.maxCorrectionAttempts) {
        return {
          validationError: error,
          originalQuery: state.originalQuery ?? state.query,
          needsCorrection: true,
        };
      }
      return { error: "não foi possível gerar uma query válida após múltiplas tentativas" };
    }

    if (state.isMultiStep) {
      const updatedSubResults = [...state.subResults, results];
      const nextStep = (state.currentStep ?? 0) + 1;
      const hasMoreSteps = nextStep < state.subQuestions.length;

      if (hasMoreSteps) {
        return { subResults: updatedSubResults, currentStep: nextStep, needsCorrection: false };
      }
      return { subResults: updatedSubResults, currentStep: nextStep, needsCorrection: false };
    }

    if (!results?.length) {
      return { error: "nenhum resultado encontrado no banco de dados" };
    }

    return { dbResults: results, needsCorrection: false };
  };
}
```

Note a diferença entre dois tipos de "vazio": `results === null` significa **erro de execução** (query inválida, dispara correção); `results.length === 0` significa **query válida, mas sem dados** — tratado como um caso de negócio, não como falha técnica.

## Passo 7 — Roteamento condicional após o executor

```typescript
function routeAfterExecutor(state: GraphState): string {
  if (state.error) return "analyticsResponseNode";
  if (state.needsCorrection) return "cypherCorrectionNode";
  if (state.isMultiStep && (state.currentStep ?? 0) < state.subQuestions.length) {
    return "cypherGeneratorNode"; // ainda tem sub-perguntas pendentes
  }
  return "analyticsResponseNode";
}
```

## Passo 8 — O nó de correção

```typescript
// src/graph/cypherCorrectionNode.ts
const CypherCorrectionSchema = z.object({ correctedQuery: z.string() });

export function createCypherCorrectionNode(llmClient: OpenRouterService, neo4jService: Neo4jService) {
  return async function cypherCorrectionNode(state: GraphState): Promise<Partial<GraphState>> {
    const schema = await neo4jService.getSchema();
    const systemPrompt = getSystemPrompt({ schema });
    const userPrompt = getUserPrompt({
      query: state.query!,
      validationError: state.validationError!,
      originalQuestion: state.question!,
    });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, CypherCorrectionSchema);

    if (!result.success) {
      return { error: "falha ao corrigir query" };
    }

    return {
      query: result.data.correctedQuery,
      originalQuery: state.originalQuery,
      correctionAttempts: (state.correctionAttempts ?? 0) + 1,
      needsCorrection: false,
    };
  };
}
```

A correção volta para o `cypherExecutorNode` (não direto para o cliente) — o ciclo se repete até a query passar na validação ou até esgotar `maxCorrectionAttempts`.

## Passo 9 — O nó de resposta analítica (sucesso e erro)

```typescript
// src/graph/analyticsResponseNode.ts
const AnalyticsResponseSchema = z.object({
  answer: z.string(),
  followUpQuestions: z.array(z.string()).default([]),
});

async function renderErrorResponse(state: GraphState, llmClient: OpenRouterService) {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getErrorUserPrompt({ error: state.error!, question: state.question! });

  const result = await llmClient.generateStructured(systemPrompt, userPrompt, AnalyticsResponseSchema);
  const answer = result.success ? result.data.answer : `Ocorreu um erro: ${state.error}`;

  return { messages: [...state.messages, new AIMessage(answer)], answer, followUpQuestions: [] };
}

async function renderSuccessResponse(state: GraphState, llmClient: OpenRouterService) {
  const isMultiStepComplete = state.isMultiStep && state.subResults.length && state.subQuestions.length;

  const userPrompt = isMultiStepComplete
    ? getMultiStepSynthesisPrompt({
        originalQuestion: state.question,
        steps: state.subResults.map((results, index) => ({
          stepNumber: index + 1,
          question: state.subQuestions[index],
          query: state.subQueries[index],
          results: JSON.stringify(results),
        })),
      })
    : getSingleStepUserPrompt({ question: state.question, query: state.query, results: JSON.stringify(state.dbResults) });

  const systemPrompt = getSystemPrompt();
  const result = await llmClient.generateStructured(systemPrompt, userPrompt, AnalyticsResponseSchema);

  if (!result.success) {
    return { error: "falha ao gerar resposta final" };
  }

  return {
    messages: [...state.messages, new AIMessage(result.data.answer)],
    answer: result.data.answer,
    followUpQuestions: result.data.followUpQuestions,
  };
}

export function createAnalyticsResponseNode(llmClient: OpenRouterService) {
  return async function analyticsResponseNode(state: GraphState): Promise<Partial<GraphState>> {
    if (state.error) {
      return renderErrorResponse(state, llmClient);
    }
    return renderSuccessResponse(state, llmClient);
  };
}
```

O caso multi-step monta um prompt que agrega **cada passo** (pergunta, query, resultado) numa única síntese — é isso que permite ao modelo gerar um relatório coerente combinando várias consultas, em vez de retornar respostas fragmentadas.

## Passo 10 — Montando o grafo completo

```typescript
export function buildGraph(llmClient: OpenRouterService, neo4jService: Neo4jService) {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("queryPlannerNode", createQueryPlannerNode(llmClient))
    .addNode("cypherGeneratorNode", createCypherGeneratorNode(llmClient, neo4jService))
    .addNode("cypherExecutorNode", createCypherExecutorNode(neo4jService))
    .addNode("cypherCorrectionNode", createCypherCorrectionNode(llmClient, neo4jService))
    .addNode("analyticsResponseNode", createAnalyticsResponseNode(llmClient))
    .addEdge(START, "queryPlannerNode")
    .addEdge("queryPlannerNode", "cypherGeneratorNode")
    .addEdge("cypherGeneratorNode", "cypherExecutorNode")
    .addConditionalEdges("cypherExecutorNode", routeAfterExecutor, {
      cypherCorrectionNode: "cypherCorrectionNode",
      cypherGeneratorNode: "cypherGeneratorNode",
      analyticsResponseNode: "analyticsResponseNode",
    })
    .addEdge("cypherCorrectionNode", "cypherExecutorNode")
    .addEdge("analyticsResponseNode", END);

  return workflow.compile();
}
```

## Passo 11 — Testando fim a fim

```bash
npm run seed   # popula o Neo4j com dados de teste (alunos, cursos, vendas, progresso)
npm run dev
```

Teste perguntas simples ("quantos cursos existem na academia?") e complexas ("quais cursos são normalmente comprados juntos?"). No LangGraph Studio, observe o grafo: perguntas complexas devem mostrar o ciclo `cypherGeneratorNode ↔ cypherExecutorNode` se repetindo uma vez por sub-pergunta, e o ciclo extra com `cypherCorrectionNode` quando uma query falha.

## Onde isso te deixa

Você tem agora um agente de "texto para query" com três camadas de resiliência: decomposição de perguntas complexas em sub-perguntas, validação e correção automática de queries inválidas, e um limite de tentativas explícito para nunca entrar em loop infinito — o padrão completo de como transformar uma pergunta de negócio livre em uma resposta confiável, mesmo usando modelos de LLM mais baratos e propensos a erro.

## Verifique seu entendimento

1. Qual a diferença de tratamento entre uma query que falha na validação de sintaxe e uma query válida que retorna zero resultados?
2. Por que `EXPLAIN` é usado antes de executar a query de fato?
3. O que aconteceria se `cypherCorrectionNode` não tivesse um limite de tentativas (`maxCorrectionAttempts`)?
4. Por que o prompt de síntese multi-step recebe cada sub-pergunta, sua query e seu resultado, em vez de só o resultado final agregado?
