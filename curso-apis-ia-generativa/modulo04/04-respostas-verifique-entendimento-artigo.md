---
title: "Respostas: Verifique seu entendimento (01-artigo-memoria-preferencias-e-resumo)"
modulo: 4
tipo: respostas
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [memoria, langgraph, postgres, sqlite, resumo-de-contexto, revisao]
fonte: docs/curso-apis-ia-generativa/modulo04/01-artigo-memoria-preferencias-e-resumo.md
---
# Respostas: Verifique seu entendimento — 01-artigo-memoria-preferencias-e-resumo

Respostas às 5 perguntas de fixação do artigo [Memória em agentes de IA: preferências, histórico e resumo](01-artigo-memoria-preferencias-e-resumo.md), ligando cada uma ao código real do projeto em `modulo04/project/`.

## 1. Qual a diferença entre memória de curto prazo e memória de longo prazo, e por que elas costumam usar armazenamentos diferentes?

**Memória de curto prazo** é o histórico de mensagens de uma conversa específica (uma
*thread*) — o que foi dito há poucas trocas, dentro da mesma sessão. No projeto, isso é
o array `messages` do `GraphStateSchema` (`src/graph/graph.ts`), persistido entre
chamadas pelo `checkpointer` do Postgres (`src/services/memoryService.ts`), e agrupado
por `thread_id` (o próprio `userId`, definido em `src/cli.ts`).

**Memória de longo prazo** é o conjunto de fatos sobre um cliente que precisa
sobreviver **entre conversas diferentes** — nome, idade, gêneros e bandas favoritas.
No projeto, isso é a tabela `user_preferences` do SQLite, gerenciada por
`PreferencesService` (`src/services/preferencesService.ts`).

Elas usam armazenamentos diferentes porque têm perfis de crescimento e de acesso bem
distintos: o histórico de conversa **cresce sem limite natural** (por isso precisa do
`summarizeNode` para ser podado) e é acessado como uma sequência ordenada por thread —
exatamente o que o `checkpointer` do LangGraph foi desenhado para fazer. Já as
preferências são um conjunto **pequeno e estável** de campos por usuário, consultado
como uma busca simples por `user_id` — um caso de uso mais simples, que o projeto
resolveu com SQLite em vez de reaproveitar o Postgres para tudo (mesmo sendo possível),
só para mostrar as duas abordagens na prática.

## 2. Como o agente extrai preferências dos clientes sem usar um formulário explícito?

Via **output estruturado** — a mesma técnica do módulo 3, agora aplicada a um problema
diferente. Em `src/graph/chatNode.ts`, toda vez que o cliente manda uma mensagem, o
`chatNode` chama `llmClient.generateStructured(...)` com o schema
`ChatResponseSchema` (`src/graph/prompts/chatPrompts.ts`), que inclui um campo
`preferences` (nome, idade, gêneros, bandas) e um campo `shouldSavePreferences`.

O modelo recebe instruções explícitas no system prompt (`getSystemPrompt`) para
"preencher somente os campos mencionados explicitamente pelo cliente; nunca inventar
dados", e para marcar `shouldSavePreferences: true` só quando a mensagem trouxer algo
novo ou atualizado. Se o cliente disser "adoro Foo Fighters" no meio de uma pergunta
qualquer, o modelo já devolve isso estruturado — sem precisar de um formulário
separado nem de um comando específico do tipo "cadastrar preferência". O `chatNode`
então repassa esse resultado para `extractedPreferences` no estado do grafo, que o
`savePreferencesNode` persiste no SQLite via `mergePreferences`.

## 3. O que é um "checkpoint" no contexto do LangGraph, e que problema ele resolve?

Um checkpoint é um **snapshot do estado do grafo**, salvo automaticamente por
`thread_id` sempre que o grafo executa. No projeto, isso é feito pelo `PostgresSaver`
(`src/services/memoryService.ts`), configurado como `checkpointer` na hora de compilar
o grafo (`src/graph/factory.ts`, `graph.compile({ checkpointer, store })`).

O problema que ele resolve: sem checkpoint, cada chamada a `graph.invoke(...)` seria
uma execução isolada, começando do zero — o cliente teria que repetir tudo a cada nova
conversa. Com o checkpointer configurado e um `thread_id` fixo (o próprio `userId`, em
`src/cli.ts`), rodar `npm run chat -- --user=eric-wendel` dias depois recupera
automaticamente o histórico de mensagens daquele usuário específico, e a conversa
continua exatamente de onde parou — sem o código precisar recarregar nada
manualmente.

## 4. Por que resumir o histórico é incremental (junta o resumo anterior com as mensagens novas) em vez de sempre resumir do zero?

Porque resumir do zero, a cada vez, descartaria informações que só apareceram em
resumos anteriores e já não estão mais nas mensagens "cruas" do estado (elas foram
removidas na rodada de resumo anterior, via `RemoveMessage`). Em
`src/graph/summarizeNode.ts`, a variável `previousSummary` (`state.conversationSummary`)
é passada, junto com o histórico atual, para `getSummarizationUserPrompt`
(`src/graph/prompts/summarizationPrompts.ts`) — e o system prompt instrui
explicitamente: "se já existir um resumo anterior, incorpore as informações novas a
ele em vez de descartá-lo".

Isso garante que o resumo seja **cumulativo**: cada nova rodada consolida o que já se
sabia com o que aconteceu de novo, em vez de perder o contexto acumulado toda vez que o
histórico volta a crescer e aciona um novo resumo.

## 5. O que aconteceria com o custo e a confiabilidade de uma aplicação de chat se ela nunca resumisse ou limitasse o histórico de conversa?

O custo por chamada cresceria **sem limite**: em `chatNode.ts`, o histórico inteiro é
serializado como texto (`conversationHistory`) e enviado dentro do prompt a cada nova
mensagem — sem um mecanismo de corte, uma conversa de mil mensagens mandaria as mil
mensagens de novo (e de novo) a cada turno, multiplicando o número de tokens cobrados
por chamada de forma proporcional ao tamanho total da conversa até aquele ponto.

Eventualmente, isso não seria só uma questão de custo: o histórico ultrapassaria a
**janela de contexto** do modelo (o limite de tokens que ele consegue processar por
chamada), e a chamada de IA passaria a falhar — a aplicação simplesmente pararia de
funcionar para conversas longas. É exatamente esse cenário que `needsSummarization`
(calculado em `chatNode.ts` comparando `state.messages.length` com
`maxMessagesToSummarize`) e o `summarizeNode` (que usa `RemoveMessage` para podar as
mensagens já condensadas) existem para prevenir.
