import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { type ModelConfig, config as defaultConfig, safeguardModel } from "./config.ts";
import { getMcpTools } from "./services/mcpService.ts";
import { guardrailsPromptTemplate } from "./graph/prompts/guardrailsPrompt.ts";

export type GuardrailResult = { safe: boolean; reason?: string; analysis?: string };

export class OpenRouterService {
  private config: ModelConfig;
  private llmClient: ChatOpenAI;
  private safeguardClient: ChatOpenAI;

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
        provider: {
          sort: this.config.provider.sort,
          allow_fallbacks: this.config.provider.allowFallbacks,
        },
      },
    });

    // Cliente separado, dedicado a detectar prompt injection. Repare que ele
    // nunca recebe `tools` — mesmo que este modelo seja manipulado, o pior
    // cenário é ele classificar algo perigoso como seguro; ele mesmo não tem
    // como executar nenhuma ação.
    this.safeguardClient = new ChatOpenAI({
      apiKey: this.config.apiKey,
      modelName: safeguardModel,
      temperature: 0,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": this.config.httpReferer,
          "X-Title": this.config.xTitle,
        },
      },
    });
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const tools = await getMcpTools();
    const agent = createAgent({ model: this.llmClient, tools });

    const response = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return String(response.messages.at(-1)?.content ?? "");
  }

  async checkGuardrails(userInput: string, enabled: boolean): Promise<GuardrailResult> {
    if (!enabled) {
      return { safe: true, reason: "guardrails disabled" };
    }

    const prompt = await guardrailsPromptTemplate.format({ userInput });
    const response = await this.safeguardClient.invoke([{ role: "user", content: prompt }]);
    const result = String(response.content).trim();

    if (result.toUpperCase().startsWith("UNSAFE")) {
      return { safe: false, reason: "prompt injection detectado pelo modelo de guardrail", analysis: result };
    }

    return { safe: true, analysis: result };
  }
}
