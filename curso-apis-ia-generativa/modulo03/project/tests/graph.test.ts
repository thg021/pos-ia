import { test } from "node:test";
import assert from "node:assert";
import { createServer } from "../src/server.ts";
import { buildGraph } from "../src/graph/graph.ts";
import { OpenRouterService } from "../src/openrouter-service.ts";
import { AppointmentService } from "../src/services/appointmentService.ts";

test("agenda uma consulta com sucesso", async () => {
  const llmClient = new OpenRouterService();
  const appointmentService = new AppointmentService();
  const app = createServer(buildGraph(llmClient, appointmentService));

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "Meu nome é João da Silva, quero agendar uma consulta com o doutor Alison hoje às 14h" },
  });

  const body = response.json();
  assert.strictEqual(body.intent, "schedule");
});

test("cancela uma consulta existente", async () => {
  const llmClient = new OpenRouterService();
  const appointmentService = new AppointmentService();
  const app = createServer(buildGraph(llmClient, appointmentService));

  await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "Meu nome é Maria Souza, quero agendar uma consulta com a doutora Carol amanhã às 10h" },
  });

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "Meu nome é Maria Souza, quero cancelar minha consulta com a doutora Carol amanhã às 10h" },
  });

  const body = response.json();
  assert.strictEqual(body.intent, "cancel");
});

test("pergunta fora do escopo cai no intent unknown", async () => {
  const llmClient = new OpenRouterService();
  const appointmentService = new AppointmentService();
  const app = createServer(buildGraph(llmClient, appointmentService));

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "Qual a previsão do tempo pra amanhã?" },
  });

  const body = response.json();
  assert.strictEqual(body.intent, "unknown");
});
