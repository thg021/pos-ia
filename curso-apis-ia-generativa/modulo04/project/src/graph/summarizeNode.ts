import { HumanMessage, RemoveMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import type { PreferencesService } from "../services/preferencesService.ts";
import { getSummarizationSystemPrompt, getSummarizationUserPrompt, SummarySchema } from "./prompts/summarizationPrompts.ts";

export function createSummarizeNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  return async function summarizeNode(state: GraphState): Promise<Partial<GraphState>> {
    const conversationHistory = state.messages
      .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.text}`)
      .join("\n");

    const previousSummary = state.conversationSummary;
    const systemPrompt = getSummarizationSystemPrompt();
    const userPrompt = getSummarizationUserPrompt({ conversationHistory, previousSummary });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SummarySchema);

    if (!result.success) {
      console.error("erro no summarizeNode:", result.error);
      return { needsSummarization: false };
    }

    const userId = state.userId ?? "desconhecido";
    await preferencesService.storeSummary(userId, result.data.summary);

    console.log("histórico resumido para", userId);

    // Mantém só as 2 mensagens mais recentes (última pergunta + última
    // resposta), removendo o resto do histórico que já foi condensado no
    // resumo. `RemoveMessage` é um tipo especial do LangGraph que, quando
    // incluído no retorno de um nó, instrui o reducer de mensagens
    // (`messagesStateReducer`) a remover aquela mensagem específica do estado
    // acumulado, em vez de adicionar mais uma (comportamento padrão).
    const messagesToRemove = state.messages.slice(0, -2).map((msg) => new RemoveMessage({ id: msg.id! }));

    return {
      messages: messagesToRemove,
      conversationSummary: result.data.summary,
      needsSummarization: false,
    };
  };
}
