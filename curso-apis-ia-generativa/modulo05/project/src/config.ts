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
  xTitle: "modulo05-guardrails-mcp-filesystem",
  // Preencha com um modelo real escolhido na aba "Models" do OpenRouter. Para
  // reproduzir a falha do Passo 6 do tutorial, use um modelo mais fraco; para
  // ver a defesa segurando mesmo assim (Passo 12), não precisa trocar nada,
  // porque quem passa a decidir segurança é o `safeguardModel`, não este.
  models: ["google/gemma-4-26b-a4b-it:free"],
  temperature: 0.2,
  provider: {
    sort: "throughput",
    allowFallbacks: true,
  },
};

// Modelo dedicado a detectar prompt injection, usado só pelo guardrail — nunca
// recebe as ferramentas MCP, mesmo que o modelo do agente principal receba.
export const safeguardModel = process.env.SAFEGUARD_MODEL ?? "openai/gpt-oss-safeguard-20b";

// Arquivo com os usuários de teste (papel + permissões), no lugar de um banco
// de dados — mantém o exemplo focado em segurança de prompt, não em CRUD.
export const usersFilePath = process.env.USERS_FILE_PATH ?? "./data/users.json";

// Liga/desliga a camada de guardrails por padrão (pode ser sobrescrito por
// chamada, mas o CLI usa este valor para decidir o modo de demonstração).
export const guardrailsEnabledDefault = process.env.GUARDRAILS_ENABLED !== "false";
