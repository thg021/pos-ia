import type { GraphState } from "./graph.ts";

export function identifyIntentNode(state: GraphState): GraphState {
  const lastMessage = state.messages.at(-1);
  const input = lastMessage?.text ?? "";
  const inputLower = input.toLowerCase();

  let command: GraphState["command"];
  if (inputLower.includes("upper")) {
    command = "upper";
  } else if (inputLower.includes("lower")) {
    command = "lower";
  }

  return { ...state, command, output: input };
}
