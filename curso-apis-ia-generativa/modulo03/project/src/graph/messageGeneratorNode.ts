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
