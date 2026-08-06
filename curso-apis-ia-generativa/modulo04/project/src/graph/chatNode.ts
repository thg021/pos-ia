import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import type { PreferencesService } from "../services/preferencesService.ts";
import { getSystemPrompt, getUserPromptTemplate, ChatResponseSchema } from "./prompts/chatPrompts.ts";
import { maxMessagesToSummarize } from "../config.ts";

export function createChatNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  return async function chatNode(state: GraphState): Promise<Partial<GraphState>> {
    const userId = state.userId ?? "anonimo";

    let userContext = state.userContext;
    if (!userContext) {
      const basicInfo = await preferencesService.getBasicInfo(userId);
      userContext = basicInfo ? JSON.stringify(basicInfo) : "";
    }

    const conversationHistory = state.messages
      .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.text}`)
      .join("\n");

    const lastUserMessage = state.messages.at(-1)?.text ?? "";

    const systemPrompt = getSystemPrompt(userContext);
    const userPrompt = getUserPromptTemplate({ message: lastUserMessage, conversationHistory });

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, ChatResponseSchema);

    if (!result.success) {
      console.error("erro no chatNode:", result.error);
      return {
        messages: [new AIMessage("Desculpe, encontrei um erro. Pode tentar novamente?")],
        userContext,
      };
    }

    // O LLM usa `null` para campos ausentes (exigência do structured output
    // estrito), mas o GraphStateSchema usa `undefined` — por isso a conversão
    // aqui antes de atualizar o estado.
    const preferences = result.data.preferences
      ? {
          name: result.data.preferences.name ?? undefined,
          age: result.data.preferences.age ?? undefined,
          genres: result.data.preferences.genres ?? undefined,
          bands: result.data.preferences.bands ?? undefined,
        }
      : undefined;

    return {
      messages: [new AIMessage(result.data.message)],
      userContext,
      extractedPreferences: result.data.shouldSavePreferences ? preferences : undefined,
      // +1 porque a mensagem do assistente que acabou de ser gerada ainda não
      // está refletida em `state.messages` neste ponto do código.
      needsSummarization: state.messages.length + 1 > maxMessagesToSummarize,
    };
  };
}
