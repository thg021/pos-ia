---
title: "Tasks: agente de agendamento/cancelamento (modulo03)"
modulo: 3
tipo: tasks
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
fonte: ../01-tutorial-agendamento-cancelamento-com-langgraph.md
---

# Tasks — modulo03/project

Cada task corresponde a um "Passo" do tutorial
[01-tutorial-agendamento-cancelamento-com-langgraph.md](../01-tutorial-agendamento-cancelamento-com-langgraph.md).
Marque `[x]` conforme for implementando; a ordem é sequencial porque cada passo depende do anterior.

- [x] **T00 — Ponto de partida**: copiar a base do `modulo02/project` (grafo LangGraph + API Fastify + testes via `app.inject`) para `modulo03/project`, e instalar `zod@3`.
- [x] **T01 — Estado do grafo**: criar `src/graph/graph.ts` com `GraphStateSchema` (intent, professionalId, professionalName, dateTime, patientName, reason, actionSuccess, actionError).
- [x] **T02 — Schema de intenção**: criar `IntentSchema` em `src/graph/identifyIntentNode.ts`.
- [x] **T03 — Serviço de LLM com output estruturado**: criar `src/openrouter-service.ts` com `OpenRouterService.generateStructured` usando `ChatOpenAI` + `withStructuredOutput`.
- [x] **T04 — Nó `identifyIntent`**: implementar `createIdentifyIntentNode` em `src/graph/identifyIntentNode.ts`, incluindo `src/graph/prompts/identifyIntentPrompts.ts` (`getSystemPrompt`/`getUserPrompt`).
- [x] **T05 — Roteamento condicional**: implementar `routeByIntent` (schedule / cancel / messageGenerator).
- [x] **T06 — Nó `scheduleNode`**: criar `src/graph/scheduleNode.ts` com validação própria via `ScheduleRequiredSchema` e `src/services/appointmentService.ts` (`bookAppointment`).
- [x] **T07 — Nó `cancelNode`**: criar `src/graph/cancelNode.ts` com `CancelRequiredSchema` e `appointmentService.cancelAppointment`.
- [x] **T08 — Nó `messageGeneratorNode`**: criar `src/graph/messageGeneratorNode.ts` + `src/graph/prompts/messageGeneratorPrompts.ts`, convertendo o resultado técnico em mensagem natural.
- [x] **T09 — Montagem do grafo**: implementar `buildGraph` em `src/graph/graph.ts` ligando os nós e `addConditionalEdges`.
- [x] **T10 — Testes end-to-end**: criar `tests/graph.test.ts` cobrindo agendamento, cancelamento e intent unknown via `app.inject` (rodar com uma `OPENROUTER_API_KEY` real no `.env` — sem chave, os 2 primeiros caem em "unknown" por falha de autenticação, o que é esperado).
- [ ] **T11 — Exploração no LangGraph Studio**: validar visualmente no Studio/LangSmith (sem artefato de código — só checklist manual).

## Depois do código

- [x] **T12 — Anotação linha a linha**: `modulo03/02-anotacao-projeto-agendamento-cancelamento.md` (mesmo padrão de `modulo02/06-anotacao-projeto-grafo-langgraph.md`).
- [x] **T13 — Quiz de revisão**: `modulo03/03-quiz-revisao-modulo03.md` (mesmo padrão de `modulo02/07-quiz-revisao-modulo02.md`).
- [x] **T14 — Material interativo**: `modulo03/material-interativo.html` (blocos de código com syntax highlighting no tema Dracula; seção de quiz interativo com correção automática na 3ª estação).
