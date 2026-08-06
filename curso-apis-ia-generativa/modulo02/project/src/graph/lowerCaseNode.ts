import type { GraphState } from "./graph.ts";

export function lowerCaseNode(state: GraphState): GraphState {
  return { ...state, output: state.output.toLowerCase() };
}
