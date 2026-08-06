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
