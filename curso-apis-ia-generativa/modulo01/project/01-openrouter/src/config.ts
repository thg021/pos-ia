export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  port: number;
  models: string[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
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
  xTitle: "smart-model-router-gateway",
  port: 3000,
  // Preencha com um modelo real, escolhido na aba "Models" do OpenRouter
  // ordenando por preço (ou throughput, conforme o critério que quiser testar).
  models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-26b-a4b-it:free"],
  temperature: 0.2,
  maxTokens: 50,
  systemPrompt: "Você é um assistente útil e prestativo. Responda de forma clara e concisa.",
  provider: {
    sort: "price",
    allowFallbacks: false,
  },
};
