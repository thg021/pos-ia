import { buildGraph } from "./graph.ts";
import { OpenRouterService } from "../openrouter-service.ts";

// Usado pelo LangGraph CLI/Studio (`npm run langgraph:serve`) e pelo `cli.ts`
// — um único grafo compilado, construído uma vez quando este módulo é
// carregado.
export const graph = buildGraph(new OpenRouterService());
