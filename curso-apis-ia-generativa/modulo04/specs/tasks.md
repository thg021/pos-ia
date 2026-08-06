---
title: "Tasks: recomendador de música com memória (modulo04)"
modulo: 4
tipo: tasks
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
fonte: ../01-tutorial-recomendador-de-musica-com-memoria.md
---

# Tasks — modulo04/project

Cada task corresponde a um "Passo" do tutorial
[01-tutorial-recomendador-de-musica-com-memoria.md](../01-tutorial-recomendador-de-musica-com-memoria.md).
Marque `[x]` conforme for implementando; a ordem é sequencial porque cada passo depende do anterior.

- [x] **T00 — Infraestrutura**: instalar `@langchain/langgraph-checkpoint-postgres`, `pg`, `better-sqlite3` e `knex`; subir o Postgres local com `docker compose up -d`.
- [x] **T01 — Estado do grafo**: criar `src/graph/graph.ts` com `GraphStateSchema` (messages, userId, userContext, extractedPreferences, shouldSavePreferences, conversationSummary, needsSummarization).
- [x] **T02 — Serviço de memória (Postgres)**: criar `src/services/memoryService.ts` com `createMemoryService` (`PostgresSaver` + `PostgresStore`, `.setup()` de cada um).
- [x] **T03 — Serviço de preferências (SQLite)**: criar `src/services/preferencesService.ts` com `PreferencesService` (`getBasicInfo`, `mergePreferences`, `storeSummary`), incluindo auto-criação da tabela `user_preferences` via knex.
- [x] **T04 — Factory do grafo**: implementar `buildAppGraph` em `src/graph/factory.ts`, ligando `memoryService`, `preferencesService` e `llmClient`, e compilando o grafo com `checkpointer`/`store`.
- [x] **T05 — Nó `chatNode`**: implementar `createChatNode` em `src/graph/chatNode.ts` + `src/graph/prompts/chatPrompts.ts` (`ChatResponseSchema`, `getSystemPrompt`, `getUserPromptTemplate`), incluindo a extração implícita de preferências e o cálculo de `needsSummarization`.
- [x] **T06 — Nó `savePreferencesNode`**: criar `src/graph/savePreferencesNode.ts`, persistindo `extractedPreferences` via `PreferencesService.mergePreferences` e limpando o campo do estado depois.
- [x] **T07 — Roteamento condicional pós-chat**: implementar `routeAfterChat` e `routeAfterSavePreferences` em `src/graph/graph.ts` (salvar preferências e/ou resumir, ou encerrar em `END`).
- [x] **T08 — Nó de resumo (`summarizeNode`)**: criar `src/graph/summarizeNode.ts` + `src/graph/prompts/summarizationPrompts.ts` (`SummarySchema`, resumo incremental via `previousSummary`), usando `RemoveMessage` para podar o histórico já condensado.
- [x] **T09 — Montagem do grafo completo**: implementar `buildGraph` em `src/graph/graph.ts`, ligando `chatNode`/`savePreferencesNode`/`summarizeNode` com `addConditionalEdges`.
- [x] **T10 — Testando via linha de comando**: criar `src/cli.ts` (loop de conversa via `readline`, parsing de `--user=`, `thread_id` = `userId`) e `src/index.ts` (`import "./cli.ts"`); validar manualmente que encerrar e retomar com o mesmo `--user` recupera preferências e histórico.

## Depois do código

- [x] **T11 — Testes automatizados**: `tests/graph.test.ts` cobrindo `PreferencesService` (SQLite local, sem dependências externas) e um teste de fluxo do grafo via `OpenRouterService` real.
- [x] **T12 — Anotação linha a linha**: `modulo04/02-anotacao-projeto-recomendador-musica-memoria.md` (mesmo padrão de `modulo03/02-anotacao-projeto-agendamento-cancelamento.md`).
- [x] **T13 — Quiz de revisão**: `modulo04/03-quiz-revisao-modulo04.md` (mesmo padrão de `modulo03/03-quiz-revisao-modulo03.md`).
- [x] **T14 — Respostas do artigo**: `modulo04/04-respostas-verifique-entendimento-artigo.md` (mesmo padrão de `modulo03/04-respostas-verifique-entendimento-artigo.md`).
- [x] **T15 — Material interativo**: `modulo04/material-interativo.html` (mesma estrutura/tema do módulo 3; blocos de código com syntax highlighting Dracula; seção de quiz interativo com correção automática).
