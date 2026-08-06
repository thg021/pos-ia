import OpenAI from "openai";
import { type ModelConfig, config as defaultConfig } from "./config.ts";

export type LlmResponse = {
  model: string;
  content: string;
};

export class OpenRouterService {
  private client: OpenAI;
  private config: ModelConfig;

  constructor(configOverride?: Partial<ModelConfig>) {
    this.config = { ...defaultConfig, ...configOverride };
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": this.config.httpReferer,
        "X-Title": this.config.xTitle,
      },
    });
  }

  async generate(question: string): Promise<LlmResponse> {
    // "models" e "provider" são extensões específicas da OpenRouter sobre a API
    // da OpenAI (roteamento entre múltiplos modelos e critério de seleção) —
    // por isso não aparecem no tipo oficial do SDK "openai".
    const response = await this.client.chat.completions.create({
      model: this.config.models[0]!,
      models: this.config.models,
      messages: [
        { role: "system", content: this.config.systemPrompt },
        { role: "user", content: question },
      ],
      stream: false,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      // A API REST da OpenRouter usa snake_case ("allow_fallbacks"), diferente
      // do campo camelCase do nosso ModelConfig — por isso o mapeamento aqui.
      provider: {
        sort: this.config.provider.sort,
        allow_fallbacks: this.config.provider.allowFallbacks,
      },
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    const content = response.choices?.[0]?.message?.content ?? "";
    return { model: response.model, content: String(content) };
  }
}
