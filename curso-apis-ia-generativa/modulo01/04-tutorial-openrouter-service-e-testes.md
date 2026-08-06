---
title: "Tutorial: implementando o OpenRouterService com testes automatizados"
modulo: 1
aula: 4
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [openrouter, typescript, testes-automatizados, node-test-runner]
fonte: docs/scrap/platos-legendas/output/curso-14082629/01-modulo-01/04-openrouter-na-pratica.md
---

# Tutorial: implementando o OpenRouterService com testes automatizados

Continuando o projeto do tutorial da aula 3 (API Fastify com a rota `/chat`), agora vamos conectar essa rota de verdade ao OpenRouter, com seleção de modelo por preço ou throughput, e cobrir isso com testes automatizados usando o test runner nativo do Node.js.

## Passo 1 — Criar uma API Key no OpenRouter

No painel do OpenRouter, vá em **Keys** → **Create API Key**. Boas práticas ao criar a chave:
- Dê um nome que identifique o uso (ex: `pos-graduacao-dev`).
- Defina uma **expiração** (ex: 7 dias) — isso limita o estrago caso a chave vaze.
- Opcionalmente, defina um **limite de gasto** em dólares, para receber aviso ou bloquear o uso automaticamente ao atingir esse teto.

## Passo 2 — Variáveis de ambiente

Na raiz do projeto, crie um arquivo `.env`:

```
OPENROUTER_API_KEY=sua-chave-aqui
```

Boa prática: crie também um `.env.example` (esse sim vai para o controle de versão) com um valor de exemplo, para quem clonar o projeto saber que essa variável é obrigatória, sem expor a chave real:

```
OPENROUTER_API_KEY=your-api-key-here
```

Para o Node.js carregar o `.env` automaticamente, rode com a flag nativa:

```bash
node --env-file .env --watch src/index.ts
```

## Passo 3 — Instalar o SDK do OpenRouter

```bash
npm install @openrouter/ai-sdk-provider@0.5.1
```

(Fixando a versão pelo mesmo motivo do Fastify: reprodutibilidade — o projeto continua funcionando igual mesmo que versões futuras do SDK mudem.)

## Passo 4 — Arquivo de configuração (`config.ts`)

Centralize os valores fixos de configuração num único lugar, e falhe cedo se a variável de ambiente obrigatória não existir:

```typescript
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
  models: ["<modelo-mais-barato-do-momento>"],
  temperature: 0.2,
  maxTokens: 50,
  systemPrompt: "You are a helpful assistant.",
  provider: {
    sort: "price",
    allowFallbacks: false,
  },
};
```

Pontos importantes:
- `console.assert` com a mensagem de erro faz o projeto **quebrar cedo e de forma clara** se alguém tentar rodar sem configurar a chave — muito melhor que descobrir isso só quando a chamada ao modelo falhar silenciosamente.
- O `!` depois de `apiKey` (non-null assertion) diz ao TypeScript "eu já validei que isso não é undefined" — só é seguro usar porque a linha de cima garante isso em tempo de execução.
- A lista `models` é o que você vai preencher escolhendo modelos na tela de **Models** do OpenRouter, ordenando por preço ou throughput conforme o critério que quiser testar.

## Passo 5 — O serviço de integração (`openrouter-service.ts`)

```typescript
import OpenRouter from "@openrouter/ai-sdk-provider";
import { type ModelConfig, config as defaultConfig } from "./config.ts";

export type LlmResponse = {
  model: string;
  content: string;
};

export class OpenRouterService {
  private client: OpenRouter;
  private config: ModelConfig;

  constructor(configOverride?: Partial<ModelConfig>) {
    this.config = { ...defaultConfig, ...configOverride };
    this.client = new OpenRouter({
      apiKey: this.config.apiKey,
      httpReferer: this.config.httpReferer,
      xTitle: this.config.xTitle,
    });
  }

  async generate(question: string): Promise<LlmResponse> {
    const response = await this.client.chat.completions.create({
      models: this.config.models,
      messages: [
        { role: "system", content: this.config.systemPrompt },
        { role: "user", content: question },
      ],
      stream: false,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      provider: this.config.provider,
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    return { model: response.model, content: String(content) };
  }
}
```

Detalhes que valem atenção:
- O construtor recebe um `configOverride` **opcional e parcial** (`Partial<ModelConfig>`), e mescla com a configuração padrão. Isso é o que permite, nos testes, sobrescrever só o campo `provider.sort` sem reescrever toda a configuração.
- A lista `messages` segue o formato padrão de conversas de LLM: uma mensagem `system` (as regras que o modelo deve seguir) seguida das mensagens do usuário — e, num chat real com histórico, todas as trocas anteriores entrariam nessa mesma lista.
- `response.choices?.[0]?.message?.content ?? ""` usa encadeamento opcional para nunca quebrar caso a resposta venha vazia — mas retorna uma string vazia nesse caso, em vez de mascarar o problema silenciosamente.

## Passo 6 — Conectando a rota `/chat` ao serviço

No `server.ts` do tutorial anterior, receba o serviço como dependência (em vez de instanciá-lo dentro da rota — isso facilita testar com um serviço configurado diferente):

```typescript
export const createServer = (routerService: OpenRouterService) => {
  const app = Fastify({ logger: false });

  app.post("/chat", { schema: { /* ...igual à aula anterior... */ } }, async (request, reply) => {
    const { question } = request.body as { question: string };
    const response = await routerService.generate(question);
    reply.send(response);
  });

  return app;
};
```

E no `index.ts`:

```typescript
import { createServer } from "./server.ts";
import { OpenRouterService } from "./openrouter-service.ts";

const routerService = new OpenRouterService();
const app = createServer(routerService);
await app.listen({ port: 3000, host: "localhost" });
```

## Passo 7 — Testes automatizados com o test runner nativo do Node

Sem instalar nenhuma dependência extra, o Node.js já tem um test runner embutido. Adicione um script no `package.json`:

```json
{
  "scripts": {
    "test": "node --env-file .env --test tests/**/*.test.ts"
  }
}
```

Crie `tests/router-service.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert";
import { createServer } from "../src/server.ts";
import { OpenRouterService } from "../src/openrouter-service.ts";
import { config } from "../src/config.ts";

test("responde com o modelo mais barato disponível", async () => {
  const cheapestConfig = {
    provider: { ...config.provider, sort: "price" as const },
  };
  const routerService = new OpenRouterService(cheapestConfig);
  const app = createServer(routerService);

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    body: { question: "hello world" },
  });

  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  // Anote aqui o modelo esperado NO MOMENTO em que você escreveu o teste — preços mudam,
  // então se esse teste quebrar no futuro, é bem provável que seja só isso, não um bug real.
  assert.strictEqual(body.model, "<modelo-mais-barato-que-voce-observou>");
});

test("responde com o modelo de maior throughput disponível", async () => {
  const fastestConfig = {
    provider: { ...config.provider, sort: "throughput" as const },
  };
  const routerService = new OpenRouterService(fastestConfig);
  const app = createServer(routerService);

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    body: { question: "what is rate limiting?" },
  });

  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  assert.strictEqual(body.model, "<modelo-mais-rapido-que-voce-observou>");
});
```

Rode com `npm test`. Repare que modelos gratuitos costumam ser mais lentos para responder — é esperado que esses testes demorem alguns segundos cada.

## O que você construiu até aqui

Ao final deste módulo você tem: uma API Fastify com uma rota validada por schema, um serviço de integração com o OpenRouter que escolhe modelo por critério configurável (preço/throughput), e testes automatizados que validam esse comportamento fim-a-fim usando `app.inject` — sem precisar de nenhum cliente HTTP externo. Essa estrutura (`server.ts` + serviço de LLM + `tests/`) é a base que os módulos seguintes do curso vão reaproveitar e expandir.

## Verifique seu entendimento

1. Por que o construtor de `OpenRouterService` aceita um `configOverride` parcial em vez de exigir a configuração inteira?
2. O que aconteceria com os testes escritos aqui se, daqui a seis meses, o modelo mais barato do OpenRouter mudar? Isso significa que o código quebrou?
3. Por que a rota `/chat` recebe `routerService` como parâmetro em vez de criar sua própria instância de `OpenRouterService` internamente?
4. Qual a vantagem prática de usar o test runner nativo do Node (`node --test`) neste projeto, em vez de instalar uma biblioteca de testes externa?
