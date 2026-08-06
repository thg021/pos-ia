---
title: "Anotação: explicação linha a linha do recomendador de música com memória"
modulo: 4
aula: [1, 2, 3, 4]
tipo: anotacao
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, memoria, postgres, sqlite, checkpointer, store, structured-output, explicacao-linha-a-linha]
fonte: docs/curso-apis-ia-generativa/modulo04/project (projeto implementado a partir do tutorial 01-tutorial-recomendador-de-musica-com-memoria.md)
---
# Anotação: explicação linha a linha do projeto do módulo 4

Este documento explica, arquivo por arquivo e linha por linha, o projeto criado em
`docs/curso-apis-ia-generativa/modulo04/project/` — um assistente de recomendação
musical via linha de comando que conversa com o cliente, **extrai preferências
implicitamente** (nome, idade, gêneros, bandas) usando output estruturado, guarda o
histórico de conversa em **Postgres** (checkpointer + store do LangGraph) e as
preferências em **SQLite**, e **resume** o histórico automaticamente quando ele cresce
demais.

## Visão geral: o desenho do grafo

```
START → chatNode ─┬─ extractedPreferences? ──→ savePreferencesNode ─┬─ needsSummarization? ──→ summarizeNode → END
                   ├─ needsSummarization? ─────────────────────────→ summarizeNode ──────────────────────────→ END
                   └─ nenhum dos dois ─────────────────────────────────────────────────────────────────────→ END
```

Repare que, diferente do módulo 3 (onde cada intenção levava a um nó de ação
diferente), aqui existe **um só** nó de conversa (`chatNode`) — o roteamento
condicional não decide "que ação executar", decide **que efeitos colaterais
processar depois** da resposta já ter sido gerada: salvar preferências novas e/ou
resumir o histórico. Os dois podem acontecer na mesma chamada (por isso duas
arestas condicionais em sequência, `routeAfterChat` e `routeAfterSavePreferences`),
ou nenhum dos dois (o caminho mais comum: uma conversa normal, sem preferência nova
e sem histórico grande o suficiente).

Mapa de quem chama quem no código:

```
src/index.ts  →  só faz `import "./cli.ts"` (ver seção específica mais abaixo)
   │
   └── src/cli.ts  →  loop de conversa via readline, thread_id = userId
           │
           └── src/graph/factory.ts  →  `buildAppGraph()` monta serviços + grafo,
           │       e exporta `graph` (instância já compilada) para o CLI e o Studio
           │
           ├── src/graph/graph.ts  →  monta o StateGraph e o roteamento condicional
           │       │
           │       ├── chatNode.ts        (chama a IA → resposta + preferências extraídas)
           │       │       └── prompts/chatPrompts.ts
           │       ├── savePreferencesNode.ts  (persiste preferências no SQLite)
           │       └── summarizeNode.ts    (chama a IA de novo → resumo, poda mensagens)
           │               └── prompts/summarizationPrompts.ts
           │
           ├── services/memoryService.ts     (checkpointer + store, Postgres)
           └── services/preferencesService.ts (SQLite via knex)

openrouter-service.ts  →  cliente de LLM com output estruturado (usado por 2 nós)
config.ts               →  configuração do modelo/OpenRouter + Postgres + SQLite + limite de resumo
```

---

## `package.json`

```json
1  {
2    "name": "modulo04-recomendador-musica-memoria",
...
7    "scripts": {
8      "chat": "node --env-file .env src/index.ts",
9      "test": "node --env-file .env --test tests/**/*.test.ts",
10     "test:dev": "node --env-file .env --test --watch tests/**/*.test.ts",
11     "langgraph:serve": "npx @langchain/langgraph-cli dev"
12   },
...
16   "dependencies": {
17     "@langchain/core": "^1.2.3",
18     "@langchain/langgraph": "^1.4.8",
19     "@langchain/langgraph-checkpoint-postgres": "^1.0.4",
20     "@langchain/openai": "^1.5.5",
21     "better-sqlite3": "^13.0.2",
22     "knex": "^3.3.0",
23     "pg": "^8.22.0",
24     "zod": "^3.25.76"
25   },
26 }
```

- **Linha 8 (`chat`)**: em vez de um script `dev` que sobe uma API HTTP (como nos
  módulos 2 e 3), aqui o script principal se chama `chat` e roda `src/index.ts`
  diretamente — porque este projeto **não é uma API**, é um script de linha de
  comando interativo. Repare que também não tem `--watch`: faz pouco sentido
  reiniciar automaticamente um processo que está no meio de uma conversa via
  `readline`.
- **Linha 19 (`@langchain/langgraph-checkpoint-postgres`)**: a peça nova que não
  existia nos módulos anteriores — fornece `PostgresSaver` (checkpointer) e
  `PostgresStore` (store), as duas classes que dão ao LangGraph memória de curto e
  longo prazo apoiada em um banco real.
- **Linhas 21-22 (`better-sqlite3` e `knex`)**: a dupla usada para persistir
  preferências. `better-sqlite3` é o driver de baixo nível (síncrono, rápido) para
  arquivos `.db` do SQLite; `knex` é um **query builder** — monta SQL de forma
  programática (`.where(...)`, `.insert(...)`, `.merge()`) sem ser um ORM completo
  (não mapeia tabelas para classes automaticamente, como Prisma ou TypeORM fariam).
- **Linha 23 (`pg`)**: driver de baixo nível do Postgres — dependência transitiva
  exigida por `@langchain/langgraph-checkpoint-postgres` para falar com o banco.

---

## `.env.example`

```
1  OPENROUTER_API_KEY=cole_aqui_a_sua_chave_do_openrouter
2
3  LANGSMITH_API_KEY=cole_aqui_a_chave_que_voce_copiou_no_langsmith
4  LANGSMITH_TRACING=true
5  LANGSMITH_PROJECT=modulo04-recomendador-musica-memoria
6
7  # Connection string do Postgres local usado para checkpointer + store do LangGraph
8  # (histórico de mensagens da conversa). Suba o banco com `docker compose up -d`.
9  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/modulo04
10
11 # Arquivo SQLite local usado para persistir preferências extraídas do cliente
12 # (nome, idade, gêneros, bandas) e o resumo mais recente da conversa.
13 PREFERENCES_DB_PATH=./data/preferences.db
14
15 # Quantidade de mensagens no histórico a partir da qual o grafo aciona o
16 # resumo automático (RemoveMessage podando as mensagens mais antigas).
17 # Um valor baixo (ex: 6) ajuda a observar o resumo acontecendo durante o
18 # desenvolvimento; em produção esse número tende a ser bem maior.
19 MAX_MESSAGES_TO_SUMMARIZE=6
```

- **Linha 9 (`DATABASE_URL`)**: a novidade deste módulo — sem essa variável (ou o
  Postgres rodando), `createMemoryService` falha na inicialização, porque
  `PostgresSaver`/`PostgresStore` precisam conseguir conectar já na primeira
  chamada (`.setup()`), como veremos em `memoryService.ts`.
- **Linha 13 (`PREFERENCES_DB_PATH`)**: caminho de um **arquivo local**, não de um
  servidor — diferente do Postgres, o SQLite não precisa de nenhum processo
  separado rodando; o próprio `better-sqlite3` lê/escreve direto no arquivo.
- **Linha 19 (`MAX_MESSAGES_TO_SUMMARIZE`)**: o "gatilho" do resumo automático —
  configurável via ambiente para poder ser baixado durante o desenvolvimento (ver
  `config.ts` e `chatNode.ts` mais abaixo) sem precisar mexer no código.

> Nunca cole uma chave de API real, nem uma connection string com credenciais de
> produção, dentro de um arquivo versionado — o `.env` (sem `.example`) já está no
> `.gitignore` do repositório justamente para isso.

---

## `src/config.ts`

```typescript
1  export type ModelConfig = {
2    apiKey: string;
...
11 };
12
13 const apiKey = process.env.OPENROUTER_API_KEY;
14 console.assert(apiKey, "OPENROUTER_API_KEY not set in the environment");
15
16 export const config: ModelConfig = {
17   apiKey: apiKey!,
18   httpReferer: "https://pos-ia.com.br",
19   xTitle: "modulo04-recomendador-musica-memoria",
20   models: ["google/gemma-4-26b-a4b-it:free"],
21   temperature: 0.2,
22   provider: {
23     sort: "throughput",
24     allowFallbacks: true,
25   },
26 };
27
28 export const memoryDbUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/modulo04";
29
30 export const preferencesDbPath = process.env.PREFERENCES_DB_PATH ?? "./data/preferences.db";
31
32 export const maxMessagesToSummarize = Number(process.env.MAX_MESSAGES_TO_SUMMARIZE ?? 6);
```

- **Linhas 1-26**: exatamente o mesmo padrão `ModelConfig` dos módulos 1 e 3 — um
  **tipo** central que descreve a configuração do modelo/OpenRouter, com fallback via
  `??` para os valores default quando a variável de ambiente não existe.
- **Linhas 28-32**: a novidade deste módulo — três constantes de configuração de
  **infraestrutura** (Postgres, SQLite, limite de resumo), todas com um valor
  padrão sensato via `??`, para o projeto ainda funcionar (com valores de
  desenvolvimento) mesmo que o `.env` esteja incompleto.
- **Linha 32 (`Number(...)`)**: variáveis de ambiente **sempre** chegam como
  string — mesmo `"6"` precisa ser convertido explicitamente para o tipo `number`
  antes de ser comparado com `state.messages.length` em `chatNode.ts`.

---

## `src/openrouter-service.ts` — o cliente de LLM com output estruturado

```typescript
1  import { ChatOpenAI } from "@langchain/openai";
2  import { SystemMessage, HumanMessage } from "@langchain/core/messages";
3  import { z } from "zod";
4  import { type ModelConfig, config as defaultConfig } from "./config.ts";
5
6  export class OpenRouterService {
7    private config: ModelConfig;
8    private llmClient: ChatOpenAI;
9
10   constructor(configOverride?: Partial<ModelConfig>) {
11     this.config = { ...defaultConfig, ...configOverride };
12     this.llmClient = new ChatOpenAI({
13       apiKey: this.config.apiKey,
14       modelName: this.config.models[0],
15       temperature: this.config.temperature,
16       configuration: {
17         baseURL: "https://openrouter.ai/api/v1",
18         defaultHeaders: {
19           "HTTP-Referer": this.config.httpReferer,
20           "X-Title": this.config.xTitle,
21         },
22       },
23       modelKwargs: {
24         models: this.config.models,
25         provider: {
26           sort: this.config.provider.sort,
27           allow_fallbacks: this.config.provider.allowFallbacks,
28         },
29       },
30     });
31   }
```

Esta classe é praticamente idêntica à do módulo 3 — o mesmo truque de usar
`ChatOpenAI` apontando `baseURL` para o OpenRouter, para reaproveitar o suporte
maduro do LangChain a output estruturado. Um detalhe que passa despercebido no
módulo 3, mas fica explícito aqui:

- **Linhas 25-28 (`provider: { sort, allow_fallbacks }`)**: repare o
  `allow_fallbacks` em **snake_case**, enquanto `this.config.provider.allowFallbacks`
  (o campo de `ModelConfig`) está em **camelCase**. Isso não é inconsistência —
  é conversão deliberada: a API REST do OpenRouter espera o campo em snake_case
  dentro de `modelKwargs.provider`, mas o `ModelConfig` do projeto segue a
  convenção de nomes do TypeScript (camelCase). Por isso o construtor remapeia o
  nome do campo manualmente, em vez de simplesmente espalhar
  `...this.config.provider`.

```typescript
33   async generateStructured<T extends z.ZodTypeAny>(
34     systemPrompt: string,
35     userPrompt: string,
36     schema: T,
37   ): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
38     try {
39       const structuredLlm = this.llmClient.withStructuredOutput(schema);
40       const data = await structuredLlm.invoke([
41         new SystemMessage(systemPrompt),
42         new HumanMessage(userPrompt),
43       ]);
44       return { success: true, data };
45     } catch (error) {
46       const message = error instanceof Error ? error.message : String(error);
47       return { success: false, error: message };
48     }
49   }
50 }
```

- Mesmo padrão do módulo 3: um **generic** (`<T extends z.ZodTypeAny>`) que aceita
  qualquer schema Zod, e um **union type discriminado** por `success` como retorno
  — obrigando `chatNode` e `summarizeNode` a tratar explicitamente o caso de falha
  da chamada de IA, em vez de deixar uma exceção propagar e derrubar o processo do
  CLI inteiro.

---

## `src/services/memoryService.ts` — checkpointer e store no Postgres

```typescript
1  import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
2  import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
3
4  export type MemoryService = {
5    checkpointer: PostgresSaver;
6    store: PostgresStore;
7  };
8
9  export async function createMemoryService(connectionString: string): Promise<MemoryService> {
10   const store = PostgresStore.fromConnString(connectionString);
11   const checkpointer = PostgresSaver.fromConnString(connectionString);
12
13   await store.setup();
14   await checkpointer.setup();
15
16   console.log("memória configurada");
17   return { checkpointer, store };
18 }
```

- **Linha 4-7 (`MemoryService`)**: agrupa as duas peças de memória de longo prazo
  do LangGraph num único objeto — mesmo princípio de "tipo central" usado em
  `ModelConfig`.
- **Linha 10 e 11 (`fromConnString`)**: tanto `PostgresStore` quanto
  `PostgresSaver` sabem se conectar a partir de uma **connection string** simples
  (a mesma string, `DATABASE_URL`, para as duas) — não é preciso configurar um
  cliente `pg` manualmente.
- **Linha 13-14 (`.setup()`)**: cada classe cria (se ainda não existirem) as
  tabelas internas que usa no Postgres — é o equivalente, para o LangGraph, da
  migração automática que `PreferencesService.migrate()` faz no SQLite (ver
  abaixo). Sem chamar `.setup()`, a primeira operação real falharia porque as
  tabelas não existiriam ainda.
- **`checkpointer` vs. `store`**: são dois conceitos diferentes do LangGraph, mesmo
  apontando para o mesmo banco. O `checkpointer` guarda o **estado completo do
  grafo por thread** (permitindo `graph.invoke(..., { configurable: { thread_id }
  })` retomar exatamente de onde uma conversa parou). O `store` existe para dados
  que precisam sobreviver **entre threads diferentes** do mesmo usuário — neste
  projeto, porém, quem realmente guarda dado entre conversas é o
  `PreferencesService` (SQLite), então o `store` está configurado e disponível
  para o grafo, mas nenhum nó chama seus métodos diretamente hoje.

---

## `src/services/preferencesService.ts` — preferências no SQLite

```typescript
1  import knex, { type Knex } from "knex";
2
3  export type UserPreferencesRow = {
4    user_id: string;
5    name?: string | null;
6    age?: number | null;
7    genres?: string | null;
8    bands?: string | null;
9    conversation_summary?: string | null;
10   updated_at?: string;
11 };
12
13 const TABLE_NAME = "user_preferences";
14
15 export class PreferencesService {
16   private db: Knex;
17   private ready: Promise<void>;
18
19   constructor(dbPath: string) {
20     this.db = knex({ client: "better-sqlite3", connection: { filename: dbPath }, useNullAsDefault: true });
21     this.ready = this.migrate();
22   }
```

- **Linhas 3-11 (`UserPreferencesRow`)**: descreve o formato **da linha no banco**
  — repare que `genres` e `bands` são `string | null`, não `string[]`. É a primeira
  pista da decisão documentada mais abaixo: SQLite não tem um tipo de coluna
  array nativo, então esses campos são guardados como texto (JSON serializado).
- **Linha 20 (`useNullAsDefault: true`)**: exigido pelo knex quando o driver é
  SQLite — sem essa opção, o knex lança um aviso/erro ao tentar inserir uma linha
  com campos ausentes, porque o SQLite lida com valores default de forma
  diferente dos bancos "maiores" (Postgres, MySQL).
- **Linha 21 (`this.ready = this.migrate()`)**: a migração roda **assincronamente**
  já no construtor, mas guardada como uma `Promise` em vez de aguardada ali mesmo
  (o construtor não pode ser `async`). Cada método público (`getBasicInfo`,
  `mergePreferences`, `storeSummary`) faz `await this.ready` antes de qualquer
  consulta — garantindo que a tabela já exista, não importa a ordem em que os
  métodos forem chamados depois da instância ser criada.

```typescript
24   private async migrate(): Promise<void> {
25     const exists = await this.db.schema.hasTable(TABLE_NAME);
26     if (exists) return;
27
28     await this.db.schema.createTable(TABLE_NAME, (table) => {
29       table.string("user_id").primary();
30       table.string("name");
31       table.integer("age");
32       table.text("genres");
33       table.text("bands");
34       table.text("conversation_summary");
35       table.string("updated_at");
36     });
37   }
```

- **Linha 25-26**: a auto-criação da tabela só acontece **na primeira vez** que o
  serviço roda contra aquele arquivo — `hasTable` evita recriar (e apagar) a
  tabela toda vez que o processo sobe. Isso é o "auto-migrate" citado na decisão
  de projeto ao final deste documento: não existe uma pasta `migrations/` com
  arquivos versionados, como um projeto de produção teria — é uma simplificação
  proposital para o exercício.
- **Linhas 32-33 (`table.text("genres")` / `table.text("bands")`)**: a
  confirmação da decisão citada acima — as duas colunas são texto puro, e é
  responsabilidade do próprio `PreferencesService` (não do banco) serializar e
  desserializar o array como JSON.

```typescript
41   private serialize(data: Record<string, unknown>): Record<string, unknown> {
42     const output: Record<string, unknown> = { ...data };
43     if (Array.isArray(output.genres)) output.genres = JSON.stringify(output.genres);
44     if (Array.isArray(output.bands)) output.bands = JSON.stringify(output.bands);
45     return output;
46   }
47
48   private deserialize(row: UserPreferencesRow | undefined): Record<string, unknown> | undefined {
49     if (!row) return undefined;
50     return {
51       ...row,
52       genres: row.genres ? JSON.parse(row.genres) : undefined,
53       bands: row.bands ? JSON.parse(row.bands) : undefined,
54     };
55   }
```

- Esse par de métodos privados é a "ponte" entre o domínio (arrays de string) e a
  coluna real do banco (texto): `serialize` roda antes de qualquer `insert`,
  `deserialize` roda depois de qualquer leitura — assim, quem chama
  `getBasicInfo`/`mergePreferences` de fora nunca precisa saber que, por baixo,
  isso vira `JSON.stringify`/`JSON.parse`.

```typescript
63   async mergePreferences(userId: string, newData: Record<string, unknown>): Promise<void> {
64     await this.ready;
65     const existing = await this.getBasicInfo(userId);
66     const merged = this.serialize({
67       ...existing,
68       ...newData,
69       user_id: userId,
70       updated_at: new Date().toISOString(),
71     });
72
73     await this.db(TABLE_NAME).insert(merged).onConflict("user_id").merge();
74   }
```

- **Linhas 65-71 (`{ ...existing, ...newData, ... }`)**: o coração do "mesclar em
  vez de sobrescrever" — o spread de `newData` **depois** de `existing` garante
  que só os campos realmente mencionados na conversa atual substituem os
  antigos; qualquer campo não presente em `newData` mantém o valor que já estava
  salvo.
- **Linha 73 (`.onConflict("user_id").merge()`)**: um **upsert** (insert-ou-update)
  — se já existir uma linha com aquele `user_id` (a chave primária, definida na
  migração), o knex faz `UPDATE` em vez de falhar com erro de chave duplicada.
  Sem isso, seria preciso escrever manualmente um `if (existe) update else insert`.

---

## `src/graph/prompts/chatPrompts.ts`

```typescript
1  import { z } from "zod";
2
3  export const ChatResponseSchema = z.object({
4    message: z.string(),
5    shouldSavePreferences: z.boolean(),
6    preferences: z
7      .object({
8        name: z.string().nullable().optional(),
9        age: z.number().nullable().optional(),
10       genres: z.array(z.string()).nullable().optional(),
11       bands: z.array(z.string()).nullable().optional(),
12     })
13     .nullable()
14     .optional(),
15 });
```

- **Linhas 8-11 (`.nullable().optional()`)**: a mesma correção documentada no
  módulo 3 sobre o modo de **structured outputs** estrito da OpenAI/OpenRouter —
  todo campo opcional precisa aceitar `null` (o modo estrito exige que todo campo
  do JSON Schema esteja em `"required"`, e `null` é a forma de simular
  "ausente"). Aqui essa regra se aplica em **dois níveis**: cada campo dentro de
  `preferences` (linhas 8-11) **e** o próprio objeto `preferences` (linhas 12-14) —
  porque o cliente pode não mencionar nenhuma preferência na mensagem atual.
- **Linha 5 (`shouldSavePreferences`)**: um campo booleano dedicado, em vez de só
  checar `preferences !== null` depois — deixa explícito, no próprio schema, que
  a decisão de "vale a pena salvar isso" é responsabilidade do modelo, não uma
  inferência do código a partir de outro campo.

```typescript
19 export function getSystemPrompt(userContext: string): string {
20   return JSON.stringify({
21     papel: "Assistente de recomendação musical",
...
25     contexto_conhecido_do_cliente: userContext || "nenhum dado conhecido ainda",
26     regras: {
27       shouldSavePreferences: "true somente quando a última mensagem do cliente trouxer uma preferência nova ou atualizada (nome, idade, gênero musical, banda favorita)",
28       preferences: "Preencha somente os campos mencionados explicitamente pelo cliente; nunca invente dados",
29     },
...
34   });
35 }
```

- **Linha 25 (`contexto_conhecido_do_cliente`)**: é assim que a **memória de
  longo prazo** (o que `PreferencesService` já sabe daquele cliente, buscado em
  `chatNode`) entra na conversa — como texto dentro do próprio system prompt, não
  como uma chamada de função separada. O modelo "lê" o que já sabe sobre o
  cliente e pode, por exemplo, recomendar algo coerente com um gênero já
  conhecido sem o cliente precisar repetir.
- **Linhas 27-28**: instruções explícitas contra **alucinação de dado** — dizer
  ao modelo para nunca inventar preferências é o que mantém a extração implícita
  confiável (o mesmo cuidado do módulo 3 com `professionalId`/`patientName`).

---

## `src/graph/chatNode.ts` — o nó central da conversa

```typescript
1  import { HumanMessage, AIMessage } from "@langchain/core/messages";
2  import type { GraphState } from "./graph.ts";
3  import type { OpenRouterService } from "../openrouter-service.ts";
4  import type { PreferencesService } from "../services/preferencesService.ts";
5  import { getSystemPrompt, getUserPromptTemplate, ChatResponseSchema } from "./prompts/chatPrompts.ts";
6  import { maxMessagesToSummarize } from "../config.ts";
7
8  export function createChatNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
9    return async function chatNode(state: GraphState): Promise<Partial<GraphState>> {
10     const userId = state.userId ?? "anonimo";
11
12     let userContext = state.userContext;
13     if (!userContext) {
14       const basicInfo = await preferencesService.getBasicInfo(userId);
15       userContext = basicInfo ? JSON.stringify(basicInfo) : "";
16     }
```

- **Linha 8 (`createChatNode(llmClient, preferencesService)`)**: mesma factory de
  nó dos módulos anteriores — injeção de dependência via closure, em vez de
  instanciar os serviços dentro do próprio nó.
- **Linhas 12-16 (`userContext`)**: repare a checagem `if (!userContext)` — a
  consulta ao SQLite só acontece **na primeira vez** que o grafo roda para
  aquela thread (quando `state.userContext` ainda não foi preenchido); depois
  disso, o próprio `userContext` retornado por esta função vira parte do estado
  persistido pelo checkpointer, e chamadas seguintes na mesma conversa reusam o
  valor já carregado — evitando uma consulta redundante ao banco a cada mensagem.

```typescript
18     const conversationHistory = state.messages
19       .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.text}`)
20       .join("\n");
21
22     const lastUserMessage = state.messages.at(-1)?.text ?? "";
23
24     const systemPrompt = getSystemPrompt(userContext);
25     const userPrompt = getUserPromptTemplate({ message: lastUserMessage, conversationHistory });
26
27     const result = await llmClient.generateStructured(systemPrompt, userPrompt, ChatResponseSchema);
```

- **Linhas 18-20**: o histórico inteiro é transformado numa string simples
  (`"user: ..."` / `"assistant: ..."`) para caber no prompt — essa é a
  representação que **cresce** a cada mensagem trocada, e é exatamente o que o
  `summarizeNode` existe para conter (ver mais abaixo).

```typescript
29     if (!result.success) {
30       console.error("erro no chatNode:", result.error);
31       return {
32         messages: [new AIMessage("Desculpe, encontrei um erro. Pode tentar novamente?")],
33         userContext,
34       };
35     }
36
37     const preferences = result.data.preferences
38       ? {
39           name: result.data.preferences.name ?? undefined,
40           age: result.data.preferences.age ?? undefined,
41           genres: result.data.preferences.genres ?? undefined,
42           bands: result.data.preferences.bands ?? undefined,
43         }
44       : undefined;
45
46     return {
47       messages: [new AIMessage(result.data.message)],
48       userContext,
49       extractedPreferences: result.data.shouldSavePreferences ? preferences : undefined,
50       needsSummarization: state.messages.length + 1 > maxMessagesToSummarize,
51     };
52   };
53 }
```

- **Linhas 32 e 47 (`messages: [new AIMessage(...)]`)**: **este é o ponto mais
  importante para entender a diferença deste projeto em relação ao módulo 3.**
  Aqui o nó devolve **só a mensagem nova** — não `[...state.messages, new
  AIMessage(...)]` como no módulo 3. Isso só funciona porque `messages`, em
  `graph.ts`, usa um **reducer customizado** (`messagesStateReducer`, explicado
  na seção de `graph.ts` abaixo): é o reducer quem decide como combinar o
  retorno parcial do nó com o estado acumulado, então o nó não precisa (e não
  deve) reconstruir o array inteiro manualmente.
- **Linhas 37-44 (conversão para `undefined`)**: o modelo devolve `null` para
  campos ausentes (exigência do modo estrito, `.nullable()`), mas o
  `GraphStateSchema` usa `.optional()` (equivalente a `undefined`) para os campos
  de `extractedPreferences` — por isso essa conversão explícita `?? undefined`
  campo a campo, antes de gravar no estado do grafo.
- **Linha 49 (`extractedPreferences: ... ? preferences : undefined`)**: só
  popula o estado com as preferências extraídas se `shouldSavePreferences` for
  `true` — mesmo que o modelo tenha (por algum motivo) preenchido o objeto
  `preferences`, ele é descartado se a própria IA sinalizar que não vale a pena
  salvar naquele momento.
- **Linha 50 (`state.messages.length + 1 > maxMessagesToSummarize`)**: o `+1` é
  sutil, mas importante — neste ponto do código, a mensagem do assistente que
  acabou de ser gerada (linha 47) **ainda não está** dentro de
  `state.messages` (esse array reflete o estado **antes** desta chamada). Somar
  1 antes de comparar com o limite garante que o gatilho de resumo considere a
  mensagem que está prestes a ser adicionada, não fique sempre "um passo
  atrasado".

---

## `src/graph/savePreferencesNode.ts`

```typescript
1  import type { GraphState } from "./graph.ts";
2  import type { PreferencesService } from "../services/preferencesService.ts";
3
4  export function createSavePreferencesNode(preferencesService: PreferencesService) {
5    return async function savePreferencesNode(state: GraphState): Promise<Partial<GraphState>> {
6      if (!state.extractedPreferences) {
7        return {};
8      }
9
10     const userId = state.userId ?? "desconhecido";
11     await preferencesService.mergePreferences(userId, state.extractedPreferences);
12
13     console.log("preferências salvas para", userId, ":", state.extractedPreferences);
14
15     return { extractedPreferences: undefined };
16   };
17 }
```

- **Linhas 6-8**: uma guarda defensiva — mesmo que o grafo só roteie para este
  nó quando `routeAfterChat` já detectou `state.extractedPreferences` (ver
  `graph.ts`), o nó **ainda confere** por conta própria antes de agir. É o mesmo
  princípio "confio, mas confiro" do módulo 3, adaptado a este contexto: o nó não
  assume cegamente que a condição de roteamento garante um valor não-vazio.
- **Linha 15 (`extractedPreferences: undefined`)**: depois de persistir no
  SQLite, o campo é **limpo** do estado do grafo — ele já cumpriu seu papel
  (avisar "existe algo novo para salvar") e não precisa continuar sendo
  carregado (e potencialmente re-salvo) em turnos futuros da mesma conversa.

---

## `src/graph/prompts/summarizationPrompts.ts` e `summarizeNode.ts`

```typescript
1  import { z } from "zod";
2
3  export const SummarySchema = z.object({
4    summary: z.string(),
5  });
```

- O schema mais simples do projeto — um único campo de texto, no mesmo espírito
  do `MessageSchema` do módulo 3.

```typescript
1  import { HumanMessage, RemoveMessage } from "@langchain/core/messages";
2  import type { GraphState } from "./graph.ts";
3  import type { OpenRouterService } from "../openrouter-service.ts";
4  import type { PreferencesService } from "../services/preferencesService.ts";
5  import { getSummarizationSystemPrompt, getSummarizationUserPrompt, SummarySchema } from "./prompts/summarizationPrompts.ts";
6
7  export function createSummarizeNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
8    return async function summarizeNode(state: GraphState): Promise<Partial<GraphState>> {
9      const conversationHistory = state.messages
10       .map((msg) => `${msg instanceof HumanMessage ? "user" : "assistant"}: ${msg.text}`)
11       .join("\n");
12
13     const previousSummary = state.conversationSummary;
14     const systemPrompt = getSummarizationSystemPrompt();
15     const userPrompt = getSummarizationUserPrompt({ conversationHistory, previousSummary });
16
17     const result = await llmClient.generateStructured(systemPrompt, userPrompt, SummarySchema);
```

- **Linha 13 (`previousSummary`)**: é isso que torna o resumo **incremental** —
  em vez de resumir só as mensagens novas isoladamente, o prompt recebe o
  **resumo anterior** (se existir) junto com o histórico completo desde então,
  para o modelo produzir uma versão consolidada, não uma sequência de resumos
  desconectados.

```typescript
19     if (!result.success) {
20       console.error("erro no summarizeNode:", result.error);
21       return { needsSummarization: false };
22     }
23
24     const userId = state.userId ?? "desconhecido";
25     await preferencesService.storeSummary(userId, result.data.summary);
26
27     console.log("histórico resumido para", userId);
28
29     const messagesToRemove = state.messages.slice(0, -2).map((msg) => new RemoveMessage({ id: msg.id! }));
30
31     return {
32       messages: messagesToRemove,
33       conversationSummary: result.data.summary,
34       needsSummarization: false,
35     };
36   };
37 }
```

- **Linha 20-22**: se a chamada de resumo falhar, o nó **não trava o fluxo** —
  simplesmente desarma o gatilho (`needsSummarization: false`) e segue adiante
  sem resumir desta vez. O histórico continua grande, mas a conversa não quebra
  por causa disso; na próxima mensagem, se o histórico ainda estiver acima do
  limite, uma nova tentativa de resumo acontece.
- **Linha 25 (`preferencesService.storeSummary`)**: o resumo é persistido no
  **mesmo** SQLite das preferências (não no Postgres) — reforça que, neste
  projeto, o SQLite guarda "o que sabemos sobre o cliente entre conversas"
  (preferências + último resumo), enquanto o Postgres guarda "o estado bruto da
  conversa atual" (via checkpointer).
- **Linha 29 (`RemoveMessage`)**: o detalhe técnico central deste nó — um tipo
  especial de mensagem do LangGraph (`@langchain/core/messages`) que, ao ser
  incluído no array de retorno de um nó, instrui o **reducer** configurado para
  `messages` (`messagesStateReducer`, ver `graph.ts`) a **remover** aquela
  mensagem específica do estado acumulado, em vez de adicionar mais uma (o
  comportamento padrão do reducer). `state.messages.slice(0, -2)` seleciona
  "todas as mensagens, exceto as duas últimas" (a pergunta e a resposta mais
  recentes) — são essas que viram alvo de remoção, já que o conteúdo delas
  acabou de ser condensado no `summary`.
- **Linha 29 (`msg.id!`)**: o `!` assume que toda mensagem no histórico já tem um
  `id` atribuído — o próprio LangChain gera um `id` automaticamente para cada
  `BaseMessage` quando ela é criada, então essa suposição é segura na prática.

---

## `src/graph/graph.ts` — o coração do grafo

```typescript
1  import { StateGraph, START, END, messagesStateReducer } from "@langchain/langgraph";
2  import type { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
3  import { z } from "zod";
4  import "@langchain/langgraph/zod";
5  import { createChatNode } from "./chatNode.ts";
6  import { createSavePreferencesNode } from "./savePreferencesNode.ts";
7  import { createSummarizeNode } from "./summarizeNode.ts";
8  import type { OpenRouterService } from "../openrouter-service.ts";
9  import type { PreferencesService } from "../services/preferencesService.ts";
10
11 const GraphStateSchema = z.object({
12   messages: z
13     .custom<BaseMessage[]>()
14     .default(() => [])
15     .langgraph.reducer(messagesStateReducer, z.custom<BaseMessageLike | BaseMessageLike[]>()),
16   userId: z.string().optional(),
17   userContext: z.string().optional(),
18   extractedPreferences: z
19     .object({
20       name: z.string().optional(),
21       age: z.number().optional(),
22       genres: z.array(z.string()).optional(),
23       bands: z.array(z.string()).optional(),
24     })
25     .optional(),
26   shouldSavePreferences: z.boolean().optional(),
27   conversationSummary: z.string().optional(),
28   needsSummarization: z.boolean().optional(),
29 });
30
31 export type GraphState = z.infer<typeof GraphStateSchema>;
```

- **Linha 4 (`import "@langchain/langgraph/zod"`)**: um **import de efeito
  colateral** — não importa nenhum símbolo, só executa o módulo, que registra o
  método `.langgraph` em todo `ZodType`. Sem esse import, a linha 15
  (`.langgraph.reducer(...)`) nem existiria como método disponível — é ele quem
  "estende" o Zod com essa capacidade extra específica do LangGraph.
- **Linhas 12-15 (`messages` com `.langgraph.reducer(...)`)**: esta é a mudança
  mais importante deste módulo em relação ao módulo 3. Lá, `messages` era só
  `z.custom<BaseMessage[]>().default(() => [])` — um campo comum, onde cada
  retorno parcial de nó **substituía** o array inteiro (por isso os nós
  precisavam escrever `[...state.messages, novaMsg]` manualmente). Aqui,
  `.langgraph.reducer(messagesStateReducer, ...)` diz ao LangGraph: "para este
  campo, não substitua o valor — **funda** o retorno parcial com o estado
  acumulado usando esta função". `messagesStateReducer` é a implementação
  pronta, fornecida pelo próprio `@langchain/langgraph`, que sabe (a) acrescentar
  mensagens novas ao final da lista e (b) tratar `RemoveMessage` como uma
  instrução de remoção em vez de adição — sem esse reducer, `RemoveMessage` do
  `summarizeNode` não teria nenhum efeito especial.
- **Linha 15 (segundo argumento, `z.custom<BaseMessageLike | BaseMessageLike[]>()`)**:
  descreve o **formato de entrada** aceito pelo reducer — cada nó pode devolver
  uma mensagem só, um array de mensagens, ou instâncias de `RemoveMessage`
  misturadas; o reducer normaliza tudo isso antes de aplicar ao estado.
- **Linhas 16-28**: o restante do estado é **específico deste projeto** (não
  existia no módulo 3) — `userId` identifica o cliente (usado para consultar e
  salvar preferências), `userContext` guarda o cache do que já se sabe sobre ele
  (para não reconsultar o SQLite a cada turno), `extractedPreferences` é o
  "recado" temporário entre `chatNode` e `savePreferencesNode`,
  `conversationSummary` guarda o resumo mais recente, e `needsSummarization` é o
  gatilho booleano lido pelas funções de roteamento logo abaixo.

```typescript
41 function routeAfterChat(state: GraphState): string {
42   if (state.extractedPreferences) return "savePreferencesNode";
43   if (state.needsSummarization) return "summarizeNode";
44   return END;
45 }
46
47 function routeAfterSavePreferences(state: GraphState): string {
48   return state.needsSummarization ? "summarizeNode" : END;
49 }
```

- **Duas** funções de roteamento, não uma só — porque, diferente do módulo 3
  (onde uma única decisão de intenção definia o próximo nó), aqui podem existir
  **até dois** efeitos colaterais pendentes ao mesmo tempo (preferências novas
  **e** histórico grande). `routeAfterChat` prioriza salvar preferências
  primeiro; `routeAfterSavePreferences` decide, depois disso, se ainda falta
  resumir. Se nenhuma das duas condições for verdadeira em nenhum momento, o
  grafo termina direto em `END` a partir do próprio `chatNode`.

```typescript
51 export function buildGraph(llmClient: OpenRouterService, preferencesService: PreferencesService) {
52   const workflow = new StateGraph(GraphStateSchema)
53     .addNode("chatNode", createChatNode(llmClient, preferencesService))
54     .addNode("savePreferencesNode", createSavePreferencesNode(preferencesService))
55     .addNode("summarizeNode", createSummarizeNode(llmClient, preferencesService))
56     .addEdge(START, "chatNode")
57     .addConditionalEdges("chatNode", routeAfterChat, {
58       savePreferencesNode: "savePreferencesNode",
59       summarizeNode: "summarizeNode",
60       [END]: END,
61     })
62     .addConditionalEdges("savePreferencesNode", routeAfterSavePreferences, {
63       summarizeNode: "summarizeNode",
64       [END]: END,
65     })
66     .addEdge("summarizeNode", END);
67
68   return workflow;
69 }
```

- **Linha 68 (`return workflow`, sem `.compile()`)**: repare que, diferente do
  módulo 3 (`buildGraph` já devolvia `workflow.compile()`), aqui `buildGraph`
  devolve o `StateGraph` **ainda não compilado**. Isso é proposital: compilar um
  grafo é o momento em que se conectam o `checkpointer` e o `store` (ver
  `factory.ts`, próxima seção), e esses dois só existem depois que
  `createMemoryService` termina de configurar o Postgres — uma operação
  assíncrona que não faz sentido acontecer dentro de uma função síncrona como
  `buildGraph`. Por isso a compilação foi movida para quem monta o grafo de
  verdade (`factory.ts`), enquanto o teste do fluxo de conversa
  (`tests/graph.test.ts`) chama `.compile()` sem argumentos, dispensando
  checkpointer/store quando não precisa deles.
- **Linhas 60 e 64 (`[END]: END`)**: usa `END` (um símbolo especial exportado
  pelo `@langchain/langgraph`) tanto como **chave computada** do mapa de rotas
  quanto como **valor** — o mapa de `addConditionalEdges` precisa listar todo
  destino possível que a função de roteamento pode devolver, incluindo o caso de
  "não ir a lugar nenhum, terminar aqui".

---

## `src/graph/factory.ts`

```typescript
1  import { buildGraph } from "./graph.ts";
2  import { OpenRouterService } from "../openrouter-service.ts";
3  import { PreferencesService } from "../services/preferencesService.ts";
4  import { createMemoryService } from "../services/memoryService.ts";
5  import { memoryDbUrl, preferencesDbPath } from "../config.ts";
6
7  export async function buildAppGraph() {
8    const memoryService = await createMemoryService(memoryDbUrl);
9    const preferencesService = new PreferencesService(preferencesDbPath);
10   const llmClient = new OpenRouterService();
11
12   const graph = buildGraph(llmClient, preferencesService);
13
14   return graph.compile({
15     checkpointer: memoryService.checkpointer,
16     store: memoryService.store,
17   });
18 }
19
20 export const graph = await buildAppGraph();
```

- **Linha 7 (`buildAppGraph`, `async`)**: diferente do `factory.ts` do módulo 3
  (uma linha só, síncrona), aqui a montagem do grafo **precisa** ser assíncrona
  — porque `createMemoryService` (linha 8) faz `await store.setup()` e `await
  checkpointer.setup()` internamente, e essas chamadas de fato conversam com o
  Postgres pela rede.
- **Linha 14-17 (`graph.compile({ checkpointer, store })`)**: é exatamente aqui
  que a memória de longo prazo (Postgres) se conecta ao grafo — `compile` é o
  método que transforma o `StateGraph` (a "planta" de nós e arestas) num grafo
  executável de verdade, e é nesse momento que ele recebe os dois adaptadores de
  persistência.
- **Linha 20 (`export const graph = await buildAppGraph()`)**: um **top-level
  await** — só é possível porque o projeto usa módulos ESM (`"type": "module"`
  no `package.json`) e um target de compilação que suporta essa sintaxe (ES2022).
  O resultado é que, assim que este arquivo é importado pela primeira vez (seja
  pelo CLI, seja pelo LangGraph CLI/Studio via `langgraph.json`), o grafo já
  vem **pronto e compilado** — exigindo que o Postgres já esteja no ar
  (`docker compose up -d`) antes de rodar qualquer coisa que importe
  `factory.ts`.

---

## `langgraph.json`

```json
1  {
2    "graphs": {
3      "agent": "./src/graph/factory.ts:graph"
4    },
5    "env": ".env"
6  }
```

- **Linha 3**: aponta para o **mesmo** `export const graph` que o CLI usa — o
  LangGraph Studio e a linha de comando executam exatamente o mesmo grafo
  compilado, sem duas implementações divergentes (mesmo princípio já visto no
  módulo 3, ali entre a rota HTTP e o Studio).

---

## `src/cli.ts` e `src/index.ts`

```typescript
1  import * as readline from "node:readline/promises";
2  import { stdin, stdout } from "node:process";
3  import { HumanMessage } from "@langchain/core/messages";
4  import { graph } from "./graph/factory.ts";
5
6  function getUserIdFromArgv(): string {
7    const arg = process.argv.find((value) => value.startsWith("--user="));
8    return arg ? arg.slice("--user=".length) : "anonimo";
9  }
10
11 async function main() {
12   const userId = getUserIdFromArgv();
13   const config = { configurable: { thread_id: userId } };
14
15   console.log(`recomendador de música — conversando como "${userId}" (Ctrl+C para sair)\n`);
16
17   const rl = readline.createInterface({ input: stdin, output: stdout });
18
19   try {
20     for (;;) {
21       const question = await rl.question("você: ");
22       if (!question.trim()) continue;
23
24       const result = await graph.invoke(
25         {
26           messages: [new HumanMessage(question)],
27           userId,
28         },
29         config,
30       );
31
32       const lastMessage = result.messages.at(-1);
33       console.log(`assistente: ${lastMessage?.text ?? "(sem resposta)"}\n`);
34     }
35   } finally {
36     rl.close();
37   }
38 }
```

- **Linhas 6-9 (`getUserIdFromArgv`)**: faz um parsing manual e simples de
  `process.argv`, procurando um argumento no formato `--user=<id>` — sem
  depender de uma biblioteca de parsing de CLI (como `commander` ou `yargs`),
  porque este projeto só precisa de um único argumento opcional.
- **Linha 13 (`thread_id: userId`)**: reaproveita o próprio identificador do
  usuário como `thread_id` do LangGraph — é essa string que o `checkpointer`
  usa para agrupar os checkpoints salvos no Postgres. Rodar o comando de novo
  com o mesmo `--user=<id>` faz o grafo carregar automaticamente o estado salvo
  daquela thread (histórico de mensagens, resumo, etc.) e continuar a conversa
  de onde parou.
- **Linha 20 (`for (;;)`)**: um loop infinito deliberado — o programa só
  termina quando o processo recebe um sinal externo (`Ctrl+C`), não por uma
  condição interna de parada; é assim que um CLI de chat interativo
  normalmente funciona.
- **Linha 24-30 (`graph.invoke(input, config)`)**: repare a assinatura de dois
  argumentos — o **input** parcial do estado (mensagens + `userId`) e a
  **configuração de execução** (`config`, com o `thread_id`). É esse segundo
  argumento que faltava nos módulos anteriores (onde não existia checkpointer,
  então cada chamada era uma "conversa" isolada).

```typescript
1  import "./cli.ts";
```

- **`src/index.ts`**: diferente dos módulos 2 e 3 (onde `index.ts` criava o
  servidor Fastify e chamava `app.listen(...)`), aqui o arquivo só tem esse
  único `import` de efeito colateral. Toda a lógica de fato mora em `cli.ts` —
  `index.ts` existe apenas para manter a convenção de "ponto de entrada
  chama-se `src/index.ts`" usada em todos os módulos do curso, mesmo quando (como
  aqui) ele não faz nada além de importar outro arquivo.

---

## `tests/graph.test.ts`

```typescript
1  import { test } from "node:test";
2  import assert from "node:assert";
3  import { mkdtemp, rm } from "node:fs/promises";
4  import { tmpdir } from "node:os";
5  import path from "node:path";
6  import { HumanMessage } from "@langchain/core/messages";
7  import { PreferencesService } from "../src/services/preferencesService.ts";
8  import { buildGraph } from "../src/graph/graph.ts";
9  import { OpenRouterService } from "../src/openrouter-service.ts";
10
11 async function withTempPreferencesService(run: (service: PreferencesService) => Promise<void>) {
12   const dir = await mkdtemp(path.join(tmpdir(), "modulo04-preferences-"));
13   const dbPath = path.join(dir, "preferences.db");
14   const service = new PreferencesService(dbPath);
15
16   try {
17     await run(service);
18   } finally {
19     await service.destroy();
20     await rm(dir, { recursive: true, force: true });
21   }
22 }
```

- **Linhas 11-22**: um **helper de teste** que cria um diretório temporário de
  verdade no sistema de arquivos (`mkdtemp`), instancia um `PreferencesService`
  apontando para um arquivo `.db` dentro dele, e garante a limpeza
  (`service.destroy()` + `rm` recursivo) mesmo se o teste falhar no meio — graças
  ao `try/finally`. É assim que os quatro primeiros testes do arquivo rodam
  **sem nenhuma dependência externa** (nem Postgres, nem rede): só arquivo local.

```typescript
78 test("conversa simples: chatNode responde e não aciona resumo nem preferências", async () => {
79   await withTempPreferencesService(async (preferencesService) => {
80     const llmClient = new OpenRouterService();
81     const graph = buildGraph(llmClient, preferencesService).compile();
82
83     const result = await graph.invoke({
84       messages: [new HumanMessage("Oi, tudo bem?")],
85       userId: "teste-conversa-simples",
86     });
87
88     assert.ok(result.messages.length >= 2);
89     assert.ok(result.messages.at(-1)?.text.length > 0);
90   });
91 });
```

- **Linha 81 (`.compile()` sem argumentos)**: diferença chave em relação a
  `factory.ts` — o teste chama `.compile()` diretamente, **sem** passar
  `checkpointer`/`store`. Isso funciona porque o LangGraph aceita compilar um
  grafo sem persistência configurada (cada `.invoke()` vira uma execução
  isolada, sem memória entre chamadas) — perfeitamente adequado para testar só o
  comportamento do `chatNode` numa única "rodada", sem precisar de Postgres
  rodando.
- **Linhas 88-89**: só confere que **existe** uma resposta não-vazia — este é o
  único teste do arquivo que depende de uma `OPENROUTER_API_KEY` real
  funcionando (mesmo padrão do módulo 3): sem uma chave válida, a chamada a
  `generateStructured` falha, e o `chatNode` cai no caminho de erro (mensagem
  fixa "Desculpe, encontrei um erro...") — que ainda assim teria `text.length >
  0`, então mesmo essa asserção específica não distingue claramente sucesso de
  falha de autenticação; o objetivo do teste é validar o **formato** da resposta
  do grafo, não o conteúdo da recomendação.

---

## Decisões de projeto que complementam o tutorial

### 1. Reducer nativo (`messagesStateReducer`) em vez de reatribuição manual do array

O tutorial mostra `messages: z.custom<BaseMessage[]>().default(() => [])` — igual ao
módulo 3, sem reducer especial. No código real, `messages` usa
`.langgraph.reducer(messagesStateReducer, ...)` (via
`import "@langchain/langgraph/zod"`), e por isso `chatNode`/`savePreferencesNode`/
`summarizeNode` devolvem **só as mensagens novas** (ou `RemoveMessage`s), nunca o
array reconstruído na mão. Essa mudança não é estética: é o que **permite** o
`summarizeNode` podar mensagens de verdade via `RemoveMessage` — sem um reducer que
saiba interpretar esse tipo especial, incluir um `RemoveMessage` no retorno de um nó
não teria efeito nenhum sobre o estado acumulado.

### 2. Nós com `(state: GraphState)`, sem o `runtime: { context }` do tutorial

O tutorial mostra a assinatura `async function chatNode(state: GraphState, runtime:
{ context?: { userId?: string } })`, lendo o `userId` via
`runtime.context?.userId ?? state.userId`. No código real, todos os nós usam só
`(state: GraphState)` e leem `state.userId` diretamente — o parâmetro `runtime`
com `context` tipado dessa forma não bateu com a API real exposta pela versão do
`@langchain/langgraph` usada neste projeto. Como o `userId` já entra no `state` logo
na primeira chamada de `graph.invoke({ messages, userId }, config)` (ver
`cli.ts`), e permanece lá graças ao checkpointer, ler `state.userId` diretamente é
suficiente — sem perda de funcionalidade.

### 3. `src/index.ts` é só um `import`; a lógica de CLI vive em `src/cli.ts`

Diferente da impressão que o tutorial passa (todo o código de CLI parece estar
"solto"), o projeto real separa isso: `src/cli.ts` concentra o `readline`, o parsing
de `--user=`, a montagem do `thread_id` e o loop de conversa; `src/index.ts` só
executa `import "./cli.ts"`. Isso mantém a convenção "o processo começa em
`src/index.ts`" igual à dos outros módulos, mesmo este projeto não subindo um
servidor HTTP.

### 4. `factory.ts` exporta uma função (`buildAppGraph`) e uma instância (`graph`)

`buildAppGraph()` é assíncrona e monta tudo do zero (Postgres, SQLite, LLM client,
grafo compilado) — reutilizável, por exemplo, se um teste futuro quisesse montar
sua própria instância isolada. Mas tanto o `langgraph.json` (Studio) quanto
`src/cli.ts` precisam de um grafo **já pronto para usar**, não de uma função para
chamar — por isso o arquivo também exporta `export const graph = await
buildAppGraph()`, usando **top-level await** para expor a instância já resolvida.
As duas exportações cobrem os dois usos sem duplicar a lógica de montagem.

### 5. SQLite: arrays como JSON em coluna de texto, tabela auto-criada

O tutorial não detalha isso, mas o código precisa resolver dois problemas que só
aparecem na prática: (a) `genres` e `bands` são arrays no domínio da aplicação, mas
o SQLite não tem tipo de coluna array nativo — `PreferencesService` serializa esses
campos como JSON antes de gravar (`serialize`) e faz o parse de volta ao ler
(`deserialize`); (b) não existe uma pasta `migrations/` versionada — a tabela
`user_preferences` é criada automaticamente na primeira execução, via
`knex.schema.hasTable`/`createTable` dentro do próprio construtor de
`PreferencesService`. Ambas são simplificações propositais para um projeto de
estudo; um sistema de produção normalmente usaria um banco com suporte nativo a
array (Postgres, por exemplo) e uma ferramenta de migração versionada.

## Verifique seu entendimento

1. Por que `messages` precisa de um reducer customizado (`messagesStateReducer`)
   neste projeto, se o módulo 3 conseguia se virar sem nenhum reducer especial?
2. `chatNode` só consulta `preferencesService.getBasicInfo` quando
   `state.userContext` ainda é vazio. O que aconteceria (em termos de custo e
   comportamento) se essa consulta rodasse em toda mensagem, sem essa checagem?
3. Por que existem **duas** funções de roteamento (`routeAfterChat` e
   `routeAfterSavePreferences`) neste grafo, em vez de uma só, como no módulo 3
   (`routeByIntent`)?
4. `buildGraph`, neste projeto, devolve um `StateGraph` **não compilado** — quem
   chama `.compile()` é `factory.ts` (com checkpointer/store) ou o teste (sem
   nada). Por que essa divisão de responsabilidade faz sentido aqui, mas não
   existia no módulo 3?
5. O que aconteceria com o histórico de uma conversa se `summarizeNode` gerasse
   um novo resumo, mas **não** incluísse nenhum `RemoveMessage` no seu retorno?
