import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

export type MemoryService = {
  checkpointer: PostgresSaver;
  store: PostgresStore;
};

// `checkpointer` guarda o estado do grafo por *thread* (permitindo retomar uma
// conversa exatamente de onde parou); `store` é usado para dados que precisam
// sobreviver entre threads diferentes do mesmo usuário. Ambos apontam para o
// mesmo Postgres, mas cumprem papéis distintos dentro do LangGraph.
export async function createMemoryService(connectionString: string): Promise<MemoryService> {
  const store = PostgresStore.fromConnString(connectionString);
  const checkpointer = PostgresSaver.fromConnString(connectionString);

  await store.setup();
  await checkpointer.setup();

  console.log("memória configurada");
  return { checkpointer, store };
}
