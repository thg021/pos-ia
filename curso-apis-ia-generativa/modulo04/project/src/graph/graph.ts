import { StateGraph, START, END, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { z } from "zod";
// Import "de efeito colateral": registra o método `.langgraph` em todo ZodType,
// usado logo abaixo para dar ao campo `messages` um reducer especial (em vez
// do comportamento padrão de "substituir o valor inteiro a cada atualização").
import "@langchain/langgraph/zod";
import { createChatNode } from "./chatNode.ts";
import { createSavePreferencesNode } from "./savePreferencesNode.ts";
import { createSummarizeNode } from "./summarizeNode.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import type { PreferencesService } from "../services/preferencesService.ts";

const GraphStateSchema = z.object({
  // `messagesStateReducer` sabe lidar com `RemoveMessage` (usado pelo
  // summarizeNode para podar histórico já resumido) e com o comportamento
  // padrão de "acrescentar mensagem nova" — sem ele, cada retorno parcial de
  // um nó substituiria o histórico inteiro em vez de mesclar com o que já
  // existe no estado.
  messages: z
    .custom<BaseMessage[]>()
    .default(() => [])
    .langgraph.reducer(messagesStateReducer, z.custom<BaseMessageLike | BaseMessageLike[]>()),
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

function routeAfterChat(state: GraphState): string {
  if (state.extractedPreferences) return "savePreferencesNode";
  if (state.needsSummarization) return "summarizeNode";
  return END;
}

function routeAfterSavePreferences(state: GraphState): string {
  return state.needsSummarization ? "summarizeNode" : END;
}

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

  return workflow;
}
