import { buildGraph } from "./graph.ts";
import { OpenRouterService } from "../openrouter-service.ts";
import { PreferencesService } from "../services/preferencesService.ts";
import { createMemoryService } from "../services/memoryService.ts";
import { memoryDbUrl, preferencesDbPath } from "../config.ts";

export async function buildAppGraph() {
  const memoryService = await createMemoryService(memoryDbUrl);
  const preferencesService = new PreferencesService(preferencesDbPath);
  const llmClient = new OpenRouterService();

  const graph = buildGraph(llmClient, preferencesService);

  return graph.compile({
    checkpointer: memoryService.checkpointer,
    store: memoryService.store,
  });
}

// Usado pelo LangGraph CLI/Studio (`npm run langgraph:serve`) e pelo `cli.ts`
// — um único grafo compilado, construído uma vez quando este módulo é
// carregado (por isso exige o Postgres já rodando: `docker compose up -d`).
export const graph = await buildAppGraph();
