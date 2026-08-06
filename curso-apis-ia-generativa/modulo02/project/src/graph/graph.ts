import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { identifyIntentNode } from "./identifyIntentNode.ts";
import { chatResponseNode } from "./chatResponseNode.ts";
import { upperCaseNode } from "./upperCaseNode.ts";
import { lowerCaseNode } from "./lowerCaseNode.ts";
import { fallbackNode } from "./fallbackNode.ts";

// @langchain/langgraph@0.2.17 (a versão pinada pelo tutorial) ainda não tem
// suporte nativo a schema Zod no StateGraph — por isso o estado é definido
// com `Annotation.Root`, a forma nativa desta versão. Cada nó sempre devolve
// o estado inteiro (via spread), então o reducer só precisa "substituir pelo
// valor mais novo" — o mesmo comportamento que `.default(...)` do Zod dava.
const replace = <T>(_current: T, update: T) => update;

const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: replace,
    default: () => [],
  }),
  output: Annotation<string>({
    reducer: replace,
    default: () => "",
  }),
  command: Annotation<"upper" | "lower" | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
});

export type GraphState = typeof GraphAnnotation.State;

function routeByCommand(state: GraphState): string {
  switch (state.command) {
    case "upper":
      return "upperCaseNode";
    case "lower":
      return "lowerCaseNode";
    default:
      return "fallbackNode";
  }
}

export function buildGraph() {
  const workflow = new StateGraph(GraphAnnotation)
    .addNode("identifyIntent", identifyIntentNode)
    .addNode("upperCaseNode", upperCaseNode)
    .addNode("lowerCaseNode", lowerCaseNode)
    .addNode("fallbackNode", fallbackNode)
    .addNode("chatResponse", chatResponseNode)
    .addEdge(START, "identifyIntent")
    .addConditionalEdges("identifyIntent", routeByCommand, {
      upperCaseNode: "upperCaseNode",
      lowerCaseNode: "lowerCaseNode",
      fallbackNode: "fallbackNode",
    })
    .addEdge("upperCaseNode", "chatResponse")
    .addEdge("lowerCaseNode", "chatResponse")
    .addEdge("fallbackNode", "chatResponse")
    .addEdge("chatResponse", END);

  return workflow.compile();
}
