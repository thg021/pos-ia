import type { GraphState } from "./graph.ts";

export function upperCaseNode(state: GraphState): GraphState {
  return { ...state, output: state.output.toUpperCase() };
}
