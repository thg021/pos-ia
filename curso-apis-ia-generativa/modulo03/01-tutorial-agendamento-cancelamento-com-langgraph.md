---
title: "Tutorial: agendamento e cancelamento de consultas com output estruturado"
modulo: 3
aula: [1, 2, 3, 4]
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [structured-output, json-schema, zod, langgraph, agentes, typescript]
fonte: docs/scrap/platos-legendas/output/curso-14082629/03-modulo-03/
---

# Tutorial: agendamento e cancelamento de consultas com output estruturado

Este tutorial cobre a implementação completa do módulo: um agente que identifica se o cliente quer **agendar** ou **cancelar** uma consulta médica a partir de uma frase em linguagem natural, executa a ação correspondente contra um serviço interno (simulando uma API real), e devolve uma resposta amigável ao cliente.

## Passo 0 — Ponto de partida

Reaproveite a estrutura do módulo anterior (grafo LangGraph + API Fastify + testes end-to-end via `app.inject`). Adicione ao projeto:

```bash
npm install zod@3
```

> A versão 3 do Zod é usada de propósito — versões mais novas tinham incompatibilidades conhecidas com certas integrações do LangChain no momento da gravação da aula.

## Passo 1 — Modelar o estado do grafo

O estado agora carrega os dados extraídos da conversa, não só um comando simples:

```typescript
// src/graph/graph.ts
import { z } from "zod"; // zod@3

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  intent: z.enum(["schedule", "cancel", "unknown"]).optional(),
  professionalId: z.number().optional(),
  professionalName: z.string().optional(),
  dateTime: z.string().optional(),
  patientName: z.string().optional(),
  reason: z.string().optional(),
  actionSuccess: z.boolean().optional(),
  actionError: z.string().optional(),
});

export type GraphState = z.infer<typeof GraphStateSchema>;
```

## Passo 2 — O schema de saída da identificação de intenção

Esse é o "molde" que o modelo de LLM precisa preencher ao interpretar a mensagem do cliente:

```typescript
// src/graph/identifyIntentNode.ts
import { z } from "zod";

export const IntentSchema = z.object({
  intent: z.enum(["schedule", "cancel", "unknown"]),
  professionalId: z.number().optional(),
  professionalName: z.string().optional(),
  dateTime: z.string().optional(),
  patientName: z.string().optional(),
  reason: z.string().optional(),
});
```

## Passo 3 — O serviço de LLM com output estruturado

Diferente do módulo anterior (que usava o SDK nativo do OpenRouter), aqui usamos o SDK da própria OpenAI apontando para a URL do OpenRouter — para aproveitar o suporte nativo a `response_format` estruturado:

```typescript
// src/openrouter-service.ts
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { type ModelConfig, config as defaultConfig } from "./config.ts";

export class OpenRouterService {
  private config: ModelConfig;
  private llmClient: ChatOpenAI;

  constructor(configOverride?: Partial<ModelConfig>) {
    this.config = { ...defaultConfig, ...configOverride };
    this.llmClient = new ChatOpenAI({
      apiKey: this.config.apiKey,
      modelName: this.config.models[0],
      temperature: this.config.temperature,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": this.config.httpReferer,
          "X-Title": this.config.xTitle,
        },
      },
      modelKwargs: {
        models: this.config.models,
        provider: this.config.provider,
      },
    });
  }

  async generateStructured<T extends z.ZodTypeAny>(
    systemPrompt: string,
    userPrompt: string,
    schema: T,
  ): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
    try {
      const structuredLlm = this.llmClient.withStructuredOutput(schema);
      const data = await structuredLlm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
```

Pontos importantes:
- `withStructuredOutput(schema)` é o método do LangChain que instrui o modelo a devolver dados já validados contra o schema Zod — sem você precisar chamar `JSON.parse` manualmente.
- O retorno usa um formato de **resultado explícito** (`{ success: true, data }` ou `{ success: false, error }`) em vez de deixar a exceção "vazar" — isso obriga quem chama a tratar os dois casos.
- `modelKwargs.provider` mantém o mesmo mecanismo de seleção de modelo por preço/throughput do módulo 1.

## Passo 4 — O nó `identifyIntent`

```typescript
// src/graph/identifyIntentNode.ts (continuação)
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import { getSystemPrompt, getUserPrompt } from "./prompts/identifyIntentPrompts.ts";

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async function identifyIntentNode(state: GraphState): Promise<Partial<GraphState>> {
    const lastMessage = state.messages.at(-1);
    const input = lastMessage?.text ?? "";

    const systemPrompt = getSystemPrompt(); // inclui lista de profissionais e regras
    const userPrompt = getUserPrompt(input);

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, IntentSchema);

    if (!result.success) {
      console.error("erro ao identificar intenção", result.error);
      return { intent: "unknown", actionError: result.error };
    }

    console.log("intenção identificada:", result.data.intent);
    return { ...result.data };
  };
}
```

Note que a função **retorna apenas o estado parcial** (`Partial<GraphState>`) — é o próprio LangGraph quem funde esse retorno parcial com o estado acumulado, então não é preciso reconstruir o objeto inteiro a cada nó.

## Passo 5 — Roteamento condicional pela intenção

```typescript
function routeByIntent(state: GraphState): string {
  switch (state.intent) {
    case "schedule":
      return "scheduleNode";
    case "cancel":
      return "cancelNode";
    default:
      return "messageGeneratorNode";
  }
}
```

## Passo 6 — O nó de agendamento, com dupla validação

```typescript
// src/graph/scheduleNode.ts
import { z } from "zod";
import type { GraphState } from "./graph.ts";
import type { AppointmentService } from "../services/appointmentService.ts";

const ScheduleRequiredSchema = z.object({
  professionalId: z.number(),
  dateTime: z.string(),
  patientName: z.string(),
});

export function createScheduleNode(appointmentService: AppointmentService) {
  return async function scheduleNode(state: GraphState): Promise<Partial<GraphState>> {
    const validation = ScheduleRequiredSchema.safeParse(state);

    if (!validation.success) {
      const errorMessages = validation.error.errors.map((e) => e.message).join(", ");
      return { actionSuccess: false, actionError: errorMessages };
    }

    try {
      const appointment = await appointmentService.bookAppointment({
        professionalId: validation.data.professionalId,
        dateTime: new Date(validation.data.dateTime),
        patientName: validation.data.patientName,
        reason: state.reason ?? "general consultation",
      });

      return { actionSuccess: true, ...appointment };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { actionSuccess: false, actionError: message };
    }
  };
}
```

Repare no princípio de **"confio, mas confiro"**: mesmo que a IA já tenha extraído os dados no nó anterior, este nó revalida com seu próprio schema antes de agir — tratando cada nó como se fosse um microsserviço independente que não confia cegamente na etapa anterior.

## Passo 7 — O nó de cancelamento (mesma estrutura)

```typescript
// src/graph/cancelNode.ts
import { z } from "zod";
import type { GraphState } from "./graph.ts";
import type { AppointmentService } from "../services/appointmentService.ts";

const CancelRequiredSchema = z.object({
  professionalId: z.number(),
  dateTime: z.string(),
  patientName: z.string(),
});

export function createCancelNode(appointmentService: AppointmentService) {
  return async function cancelNode(state: GraphState): Promise<Partial<GraphState>> {
    const validation = CancelRequiredSchema.safeParse(state);

    if (!validation.success) {
      const errorMessages = validation.error.errors.map((e) => e.message).join(", ");
      return { actionSuccess: false, actionError: errorMessages };
    }

    try {
      await appointmentService.cancelAppointment({
        professionalId: validation.data.professionalId,
        dateTime: new Date(validation.data.dateTime),
        patientName: validation.data.patientName,
      });
      return { actionSuccess: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { actionSuccess: false, actionError: message };
    }
  };
}
```

## Passo 8 — O gerador de mensagens (JSON → linguagem natural, de volta)

Este é o nó final: recebe o resultado técnico (sucesso/erro + detalhes) e usa a IA de novo — dessa vez para transformar isso em uma mensagem amigável:

```typescript
// src/graph/messageGeneratorNode.ts
import { z } from "zod";
import { AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import { getSystemPrompt, getUserPrompt } from "./prompts/messageGeneratorPrompts.ts";

const MessageSchema = z.object({ message: z.string() });

export function createMessageGeneratorNode(llmClient: OpenRouterService) {
  return async function messageGeneratorNode(state: GraphState): Promise<Partial<GraphState>> {
    const scenario = `${state.intent ?? "unknown"}_${state.actionSuccess ? "success" : "error"}`;
    const details = {
      professionalName: state.professionalName,
      dateTime: state.dateTime,
      patientName: state.patientName,
      error: state.actionError,
    };

    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt({ scenario, details });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, MessageSchema);

    if (!result.success) {
      return { messages: [...state.messages, new AIMessage("Desculpe, ocorreu um erro.")] };
    }

    return { messages: [...state.messages, new AIMessage(result.data.message)] };
  };
}
```

Repare que o `scenario` (ex: `"schedule_success"`, `"cancel_error"`) é passado para o prompt para ajudar o modelo a escolher o tom certo de resposta — a aula recomenda incluir alguns cenários e exemplos correspondentes no system prompt, para a IA não "viajar" na resposta.

## Passo 9 — Montando o grafo completo

```typescript
export function buildGraph(llmClient: OpenRouterService, appointmentService: AppointmentService) {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", createIdentifyIntentNode(llmClient))
    .addNode("scheduleNode", createScheduleNode(appointmentService))
    .addNode("cancelNode", createCancelNode(appointmentService))
    .addNode("messageGeneratorNode", createMessageGeneratorNode(llmClient))
    .addEdge(START, "identifyIntent")
    .addConditionalEdges("identifyIntent", routeByIntent, {
      scheduleNode: "scheduleNode",
      cancelNode: "cancelNode",
      messageGeneratorNode: "messageGeneratorNode",
    })
    .addEdge("scheduleNode", "messageGeneratorNode")
    .addEdge("cancelNode", "messageGeneratorNode")
    .addEdge("messageGeneratorNode", END);

  return workflow.compile();
}
```

Repare que `identifyIntent` e `messageGeneratorNode` recebem `llmClient` (precisam de IA), enquanto `scheduleNode` e `cancelNode` recebem `appointmentService` (só processam dados) — cada nó só conhece a dependência que realmente precisa, seguindo o mesmo princípio de injeção de dependência via factory já visto no módulo anterior.

## Passo 10 — Testando o fluxo completo

```typescript
test("agenda uma consulta com sucesso", async () => {
  const app = createServer(buildGraph(llmClient, appointmentService));

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    body: { question: "Meu nome é João da Silva, quero agendar uma consulta com o doutor Alison hoje às 14h" },
  });

  const body = response.json();
  assert.strictEqual(body.intent, "schedule");
});

test("cancela uma consulta existente", async () => {
  // ...mesmo padrão, mudando a mensagem para uma intenção de cancelamento
});
```

Rode com `npm test`. Como os testes chamam a API real do OpenRouter (mesmo em modelos gratuitos), espere alguns segundos por teste — e use `.skip` temporariamente em testes que você não está depurando no momento, para evitar gastar tokens/tempo à toa durante o desenvolvimento.

## Passo 11 — Explorando no LangGraph Studio

Suba o projeto com o script configurado para o Studio e, na aba de chat, mande mensagens variando a ordem das palavras (ex: "quero uma consulta amanhã às 10h com a doutora Carol" vs. "amanhã às 10h quero consulta com a doutora Carol"). Isso demonstra visualmente por que usar um modelo de LLM para extrair intenção é mais robusto que checagem de palavra-chave: a ordem das palavras não importa para o modelo. A aba de **trace** do Studio (ou do LangSmith) mostra o tempo gasto em cada etapa — útil para identificar qual nó está consumindo mais tempo/tokens.

## Onde isso te deixa

Você tem agora um agente que: extrai intenção e dados estruturados de linguagem natural, valida esses dados de forma independente em cada nó, executa uma ação de negócio real (mesmo que simulada), e traduz o resultado de volta para uma mensagem natural — o ciclo completo "texto → JSON → ação → texto" que é a espinha dorsal da maioria dos agentes de IA aplicados a produtos reais.

## Verifique seu entendimento

1. O que `withStructuredOutput(schema)` resolve que você teria que fazer manualmente sem ele?
2. Por que os nós `scheduleNode` e `cancelNode` fazem sua própria validação com Zod, mesmo recebendo dados que a IA já devia ter validado na etapa de `identifyIntent`?
3. Por que `identifyIntent` e `messageGeneratorNode` recebem o cliente de LLM como dependência, mas `scheduleNode` e `cancelNode` não?
4. O que aconteceria se dois clientes tentassem agendar o mesmo horário com o mesmo profissional ao mesmo tempo, dado como o `appointmentService` foi descrito aqui?
