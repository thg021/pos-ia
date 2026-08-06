import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import { systemPromptTemplate } from "./prompts/systemPrompt.ts";

export function createChatNode(llmClient: OpenRouterService) {
  return async function chatNode(state: GraphState): Promise<Partial<GraphState>> {
    const lastMessage = state.messages.at(-1);
    const userPrompt = lastMessage instanceof HumanMessage ? lastMessage.text : "";

    const systemPrompt = await systemPromptTemplate.format({
      userName: state.userDisplayName ?? "desconhecido",
      userRole: state.userRole ?? "member",
      userPermissions: state.userPermissions.join(", ") || "nenhuma",
    });

    // Só o agente principal recebe as ferramentas MCP (via `generate`,
    // dentro do OpenRouterService) — e só chega até aqui depois de passar
    // pelo guardrailsCheckNode.
    const responseText = await llmClient.generate(systemPrompt, userPrompt);

    return { messages: [...state.messages, new AIMessage(responseText)] };
  };
}
