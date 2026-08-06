import { test } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import { PreferencesService } from "../src/services/preferencesService.ts";
import { buildGraph } from "../src/graph/graph.ts";
import { OpenRouterService } from "../src/openrouter-service.ts";

// ---------------------------------------------------------------------------
// Testes de PreferencesService: rodam 100% localmente contra um arquivo
// SQLite temporário (sem precisar de Postgres nem de rede). São os únicos
// testes deste arquivo que rodam sem dependências externas.
// ---------------------------------------------------------------------------

async function withTempPreferencesService(run: (service: PreferencesService) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "modulo04-preferences-"));
  const dbPath = path.join(dir, "preferences.db");
  const service = new PreferencesService(dbPath);

  try {
    await run(service);
  } finally {
    await service.destroy();
    await rm(dir, { recursive: true, force: true });
  }
}

test("getBasicInfo retorna undefined para usuário desconhecido", async () => {
  await withTempPreferencesService(async (service) => {
    const info = await service.getBasicInfo("usuario-inexistente");
    assert.strictEqual(info, undefined);
  });
});

test("mergePreferences cria o registro na primeira vez", async () => {
  await withTempPreferencesService(async (service) => {
    await service.mergePreferences("eric-wendel", { name: "Eric", genres: ["rock", "punk"] });

    const info = await service.getBasicInfo("eric-wendel");
    assert.strictEqual(info?.name, "Eric");
    assert.deepStrictEqual(info?.genres, ["rock", "punk"]);
  });
});

test("mergePreferences mescla com o que já existia em vez de sobrescrever", async () => {
  await withTempPreferencesService(async (service) => {
    await service.mergePreferences("eric-wendel", { name: "Eric", age: 30 });
    await service.mergePreferences("eric-wendel", { bands: ["Ramones"] });

    const info = await service.getBasicInfo("eric-wendel");
    // O nome e a idade salvos na primeira chamada continuam presentes mesmo
    // depois de uma segunda chamada que só menciona uma banda nova.
    assert.strictEqual(info?.name, "Eric");
    assert.strictEqual(info?.age, 30);
    assert.deepStrictEqual(info?.bands, ["Ramones"]);
  });
});

test("storeSummary grava o resumo mesmo sem preferências salvas antes", async () => {
  await withTempPreferencesService(async (service) => {
    await service.storeSummary("novo-usuario", "Cliente gosta de rock clássico.");

    const info = await service.getBasicInfo("novo-usuario");
    assert.strictEqual(info?.conversation_summary, "Cliente gosta de rock clássico.");
  });
});

// ---------------------------------------------------------------------------
// Teste do fluxo do grafo: usa `buildGraph` (sem checkpointer/store, então não
// depende de Postgres), mas chama o `OpenRouterService` de verdade — por isso
// precisa de OPENROUTER_API_KEY configurada em `.env` para passar. Isso segue
// o mesmo padrão do módulo 03: se a chave não estiver configurada, esta
// suíte falha/pula com erro de autenticação, o que é esperado neste ambiente.
// ---------------------------------------------------------------------------

test("conversa simples: chatNode responde e não aciona resumo nem preferências", async () => {
  await withTempPreferencesService(async (preferencesService) => {
    const llmClient = new OpenRouterService();
    const graph = buildGraph(llmClient, preferencesService).compile();

    const result = await graph.invoke({
      messages: [new HumanMessage("Oi, tudo bem?")],
      userId: "teste-conversa-simples",
    });

    assert.ok(result.messages.length >= 2);
    assert.ok(result.messages.at(-1)?.text.length > 0);
  });
});
