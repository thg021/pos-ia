import { test } from "node:test";
import assert from "node:assert";
import { HumanMessage } from "@langchain/core/messages";
import { getUser } from "../src/services/usersService.ts";
import { buildGraph } from "../src/graph/graph.ts";
import { OpenRouterService } from "../src/openrouter-service.ts";

// ---------------------------------------------------------------------------
// Testes de usersService: rodam 100% localmente, lendo data/users.json direto
// do disco — sem depender de rede nem de nenhuma chave de API.
// ---------------------------------------------------------------------------

test("getUser retorna undefined para usuário desconhecido", async () => {
  const user = await getUser("usuario-inexistente");
  assert.strictEqual(user, undefined);
});

test("getUser carrega o usuário administrador com suas permissões", async () => {
  const user = await getUser("eric");
  assert.strictEqual(user?.role, "admin");
  assert.ok(user?.permissions.includes("read_files"));
});

test("getUser carrega o usuário membro sem nenhuma permissão", async () => {
  const user = await getUser("ana");
  assert.strictEqual(user?.role, "member");
  assert.deepStrictEqual(user?.permissions, []);
});

// ---------------------------------------------------------------------------
// Testes do fluxo do grafo: chamam o `OpenRouterService` de verdade (modelo
// principal + modelo de guardrail), então exigem OPENROUTER_API_KEY
// configurada em `.env` para passar — mesmo padrão dos módulos 3 e 4.
// ---------------------------------------------------------------------------

test("com guardrails desativados, uma mensagem comum passa direto pelo chatNode", async () => {
  const llmClient = new OpenRouterService();
  const graph = buildGraph(llmClient);

  const result = await graph.invoke({
    messages: [new HumanMessage("Oi, tudo bem?")],
    userId: "ana",
    userDisplayName: "Ana Neri",
    userRole: "member",
    userPermissions: [],
    guardrailsEnabled: false,
  });

  assert.ok(result.messages.length >= 1);
  assert.strictEqual(result.guardrailCheck?.safe, true);
  assert.strictEqual(result.guardrailCheck?.reason, "guardrails disabled");
});

test("com guardrails ativados, uma mensagem comum é classificada como segura e chega ao chatNode", async () => {
  const llmClient = new OpenRouterService();
  const graph = buildGraph(llmClient);

  const result = await graph.invoke({
    messages: [new HumanMessage("Quais arquivos de música você recomenda pra hoje?")],
    userId: "ana",
    userDisplayName: "Ana Neri",
    userRole: "member",
    userPermissions: [],
    guardrailsEnabled: true,
  });

  assert.strictEqual(result.guardrailCheck?.safe, true);
  assert.ok((result.messages.at(-1)?.text?.length ?? 0) > 0);
});
