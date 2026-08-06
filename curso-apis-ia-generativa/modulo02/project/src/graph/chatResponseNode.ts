import { AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";

export function chatResponseNode(state: GraphState): GraphState {
  const responseMessage = new AIMessage(state.output);

  return {
    ...state,
    messages: [...state.messages, responseMessage],
  };
}
