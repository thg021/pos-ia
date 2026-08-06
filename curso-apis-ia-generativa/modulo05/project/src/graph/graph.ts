import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createGuardrailsCheckNode } from "./guardrailsCheckNode.ts";
import { createChatNode } from "./chatNode.ts";
import { blockedNode } from "./blockedNode.ts";
import type { OpenRouterService } from "../openrouter-service.ts";

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  userId: z.string().optional(),
  userDisplayName: z.string().optional(),
  userRole: z.enum(["admin", "member"]).optional(),
  userPermissions: z.array(z.string()).default([]),
  guardrailsEnabled: z.boolean().default(true),
  guardrailCheck: z
    .object({ safe: z.boolean(), reason: z.string().optional(), analysis: z.string().optional() })
    .optional(),
});

export type GraphState = z.infer<typeof GraphStateSchema>;

function routeAfterGuardrails(state: GraphState): string {
  if (!state.guardrailsEnabled) return "chatNode";
  return state.guardrailCheck?.safe ? "chatNode" : "blockedNode";
}

export function buildGraph(llmClient: OpenRouterService) {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("guardrailsCheckNode", createGuardrailsCheckNode(llmClient))
    .addNode("chatNode", createChatNode(llmClient))
    .addNode("blockedNode", blockedNode)
    .addEdge(START, "guardrailsCheckNode")
    .addConditionalEdges("guardrailsCheckNode", routeAfterGuardrails, {
      chatNode: "chatNode",
      blockedNode: "blockedNode",
    })
    .addEdge("chatNode", END)
    .addEdge("blockedNode", END);

  // Diferente do módulo 4 (que compila em `factory.ts` para poder injetar
  // checkpointer/store), este grafo não precisa de memória persistente entre
  // execuções — cada chamada recebe o histórico que precisa via `messages` no
  // próprio `state`, controlado pelo `cli.ts`. Por isso já compila aqui.
  return workflow.compile();
}
