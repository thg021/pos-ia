import { z } from "zod";
import type { GraphState } from "./graph.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import { getSystemPrompt, getUserPrompt } from "./prompts/identifyIntentPrompts.ts";

// OpenRouter/OpenAI exigem, em modo de output estruturado estrito, que campos
// opcionais também sejam `.nullable()` — só `.optional()` não é suportado.
export const IntentSchema = z.object({
  intent: z.enum(["schedule", "cancel", "unknown"]),
  professionalId: z.number().nullable().optional(),
  professionalName: z.string().nullable().optional(),
  dateTime: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async function identifyIntentNode(state: GraphState): Promise<Partial<GraphState>> {
    const lastMessage = state.messages.at(-1);
    const input = lastMessage?.text ?? "";

    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(input);

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, IntentSchema);

    if (!result.success) {
      console.error("erro ao identificar intenção", result.error);
      return { intent: "unknown", actionError: result.error };
    }

    console.log("intenção identificada:", result.data.intent);

    // O LLM usa `null` para campos ausentes (exigência do structured output
    // estrito), mas o GraphStateSchema usa `undefined` (`.optional()` sem
    // `.nullable()`) — por isso a conversão aqui antes de atualizar o state.
    const { intent, professionalId, professionalName, dateTime, patientName, reason } = result.data;
    return {
      intent,
      professionalId: professionalId ?? undefined,
      professionalName: professionalName ?? undefined,
      dateTime: dateTime ?? undefined,
      patientName: patientName ?? undefined,
      reason: reason ?? undefined,
    };
  };
}
