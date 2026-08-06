import { HumanMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";

export function createGuardrailsCheckNode(llmClient: OpenRouterService) {
  return async function guardrailsCheckNode(state: GraphState): Promise<Partial<GraphState>> {
    const lastMessage = state.messages.at(-1);
    const userInput = lastMessage instanceof HumanMessage ? lastMessage.text : "";

    try {
      const result = await llmClient.checkGuardrails(userInput, state.guardrailsEnabled);
      return { guardrailCheck: result };
    } catch (error) {
      console.error("erro no guardrails check", error);
      // Falha fechado: se a verificação de segurança não conseguiu rodar (ex:
      // erro de rede), o padrão é bloquear, não liberar o acesso às ferramentas.
      return { guardrailCheck: { safe: false, reason: "erro ao validar segurança" } };
    }
  };
}
