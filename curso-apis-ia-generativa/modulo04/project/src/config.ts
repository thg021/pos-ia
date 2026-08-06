export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  models: string[];
  temperature: number;
  provider: {
    sort: "price" | "throughput" | "latency";
    allowFallbacks: boolean;
  };
};

const apiKey = process.env.OPENROUTER_API_KEY;
console.assert(apiKey, "OPENROUTER_API_KEY not set in the environment");

export const config: ModelConfig = {
  apiKey: apiKey!,
  httpReferer: "https://pos-ia.com.br",
  xTitle: "modulo04-recomendador-musica-memoria",
  // Preencha com um modelo real que suporte response_format estruturado,
  // escolhido na aba "Models" do OpenRouter (filtro supported_parameters=response_format).
  models: ["google/gemma-4-26b-a4b-it:free"],
  temperature: 0.2,
  provider: {
    sort: "throughput",
    allowFallbacks: true,
  },
};

// Connection string do Postgres usado para checkpointer + store do LangGraph
// (histórico de mensagens da conversa, por thread e por usuário).
export const memoryDbUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/modulo04";

// Arquivo SQLite local com as preferências extraídas de cada cliente
// (nome, idade, gêneros, bandas) e o resumo mais recente da conversa.
export const preferencesDbPath = process.env.PREFERENCES_DB_PATH ?? "./data/preferences.db";

// Quantidade de mensagens no histórico a partir da qual o grafo aciona o
// resumo automático. Um valor baixo ajuda a observar o resumo em desenvolvimento.
export const maxMessagesToSummarize = Number(process.env.MAX_MESSAGES_TO_SUMMARIZE ?? 6);
