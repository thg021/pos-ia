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
  xTitle: "modulo03-agendamento-cancelamento",
  // Preencha com um modelo real que suporte response_format estruturado,
  // escolhido na aba "Models" do OpenRouter (filtro supported_parameters=response_format).
  models: ["google/gemma-4-26b-a4b-it:free"],
  temperature: 0.2,
  provider: {
    sort: "throughput",
    allowFallbacks: true,
  },
};
