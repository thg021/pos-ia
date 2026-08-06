import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { type ModelConfig, config as defaultConfig } from "./config.ts";

export class OpenRouterService {
  private config: ModelConfig;
  private llmClient: ChatOpenAI;

  constructor(configOverride?: Partial<ModelConfig>) {
    this.config = { ...defaultConfig, ...configOverride };
    this.llmClient = new ChatOpenAI({
      apiKey: this.config.apiKey,
      modelName: this.config.models[0],
      temperature: this.config.temperature,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": this.config.httpReferer,
          "X-Title": this.config.xTitle,
        },
      },
      modelKwargs: {
        models: this.config.models,
        // A API REST da OpenRouter usa snake_case ("allow_fallbacks"), diferente
        // do campo camelCase do nosso ModelConfig — por isso o mapeamento aqui.
        provider: {
          sort: this.config.provider.sort,
          allow_fallbacks: this.config.provider.allowFallbacks,
        },
      },
    });
  }

  async generateStructured<T extends z.ZodTypeAny>(
    systemPrompt: string,
    userPrompt: string,
    schema: T,
  ): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
    try {
      const structuredLlm = this.llmClient.withStructuredOutput(schema);
      const data = await structuredLlm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
