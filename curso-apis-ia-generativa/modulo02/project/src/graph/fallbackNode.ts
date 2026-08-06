import type { GraphState } from "./graph.ts";

const FALLBACK_MESSAGE =
  "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";

export function fallbackNode(state: GraphState): GraphState {
  return { ...state, output: FALLBACK_MESSAGE };
}
