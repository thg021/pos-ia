---
title: "Anotação: explicação linha a linha do agente de agendamento/cancelamento"
modulo: 3
aula: [1, 2, 3, 4]
tipo: anotacao
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langchain, langgraph, structured-output, zod, openrouter, explicacao-linha-a-linha]
fonte: docs/curso-apis-ia-generativa/modulo03/project (projeto implementado a partir do tutorial 01-tutorial-agendamento-cancelamento-com-langgraph.md)
---
# Anotação: explicação linha a linha do projeto do módulo 3

Este documento explica, arquivo por arquivo e linha por linha, o projeto criado em
`docs/curso-apis-ia-generativa/modulo03/project/` — um agente LangGraph que interpreta,
em linguagem natural, se o cliente quer **agendar** ou **cancelar** uma consulta médica,
extrai os dados necessários com **output estruturado** (JSON validado por Zod, sem
`JSON.parse` manual), executa a ação contra um serviço interno, e devolve uma mensagem
amigável.

## Visão geral: o desenho do grafo

```
START → identifyIntent ─┬─ "schedule" → scheduleNode ─┐
                         ├─ "cancel"  → cancelNode   ─┼─→ messageGeneratorNode → END
                         └─ "unknown" ────────────────┘
```

Repare que este grafo é **mais enxuto** que o do módulo 2: não existe um nó separado
para "empacotar a resposta final" (como o `chatResponseNode` de lá) — quem adiciona a
`AIMessage` ao histórico é o próprio `messageGeneratorNode`, porque ele já precisa
chamar a IA de qualquer forma para gerar o texto.

Mapa de quem chama quem no código:

```
index.ts  →  cria o servidor e sobe a API
   │
   └── server.ts  →  rota POST /chat, chama graph.invoke(...)
           │
           └── graph/graph.ts  →  monta o StateGraph e o roteamento condicional
                   │
                   ├── identifyIntentNode.ts  (chama a IA → intent + dados extraídos)
                   │       └── prompts/identifyIntentPrompts.ts
                   ├── scheduleNode.ts / cancelNode.ts  (revalidam e chamam appointmentService)
                   │       └── services/appointmentService.ts
                   └── messageGeneratorNode.ts  (chama a IA de novo → texto final)
                           └── prompts/messageGeneratorPrompts.ts

openrouter-service.ts  →  cliente de LLM com output estruturado (usado por 2 nós)
config.ts               →  configuração do modelo/OpenRouter
factory.ts               →  só exporta o grafo já montado, para o LangGraph Studio encontrar
```

---

## `package.json`

```json
1  {
2    "name": "modulo03-agendamento-cancelamento",
...
7    "scripts": {
8      "dev": "node --env-file .env --watch src/index.ts",
9      "test": "node --env-file .env --test tests/**/*.test.ts",
...
15   "dependencies": {
16     "@langchain/core": "^1.2.3",
17     "@langchain/langgraph": "^1.4.8",
18     "@langchain/openai": "^1.5.5",
19     "fastify": "^5.10.0",
20     "zod": "^3.25.76"
21   },
```

- **Linha 9 (`test`)**: diferente do módulo 2 (que só tinha `test:dev`), aqui já existe
  um `npm test` "de verdade" — porque os testes deste módulo dependem de uma chamada
  real à API do OpenRouter (via `--env-file .env`), então faz sentido ter o comando
  "padrão" pronto.
- **Linhas 16-20**: diferente do módulo 2 — que tinha versões **fixadas** de propósito
  (pinadas pelo tutorial original, com vulnerabilidades conhecidas aceitas por ser um
  projeto de estudo) — aqui as dependências usam as **versões mais recentes
  disponíveis** no momento em que este projeto foi montado (`npm audit` não acusa
  nenhuma vulnerabilidade). Isso só foi possível porque a API do LangGraph que aceita
  um schema Zod diretamente em `new StateGraph(...)` (a mesma que o tutorial ensina)
  **já existe de verdade** nesta versão — ao contrário do módulo 2, não foi preciso
  nenhuma solução alternativa.
- **`@langchain/openai`**: é a peça nova que não existia no módulo 2 — fornece a
  classe `ChatOpenAI`, usada aqui para falar com o OpenRouter (que expõe uma API
  compatível com a da OpenAI) e para o método `withStructuredOutput`.
- **`zod`**: agora entra como dependência de verdade (no módulo 2 ela tinha ficado de
  fora) — é o que descreve tanto o formato do estado do grafo quanto os schemas de
  output estruturado (`IntentSchema`, `MessageSchema`, etc.).

---

## `.env.example`

```
1  OPENROUTER_API_KEY=cole_aqui_a_sua_chave_do_openrouter
2
3  LANGSMITH_API_KEY=cole_aqui_a_chave_que_voce_copiou_no_langsmith
4  LANGSMITH_TRACING=true
5  LANGSMITH_PROJECT=modulo03-agendamento-cancelamento
```

- **Linha 1 (`OPENROUTER_API_KEY`)**: diferente do módulo 2 (onde essa variável só
  existia como referência para "uma aula futura"), aqui ela é **usada de verdade** —
  é o que `config.ts` lê para autenticar as chamadas de IA.
- **Linhas 3-5**: mesmo papel do módulo 2 — autenticação e agrupamento das execuções
  no painel de observabilidade do LangSmith.

> Nunca cole uma chave de API real dentro de um arquivo versionado — o `.env` (sem
> `.example`) já está no `.gitignore` do repositório justamente para isso. Se você
> colar uma chave aqui por engano, revogue-a no painel do OpenRouter e gere uma nova.

---

## `src/config.ts`

```typescript
1  export type ModelConfig = {
2    apiKey: string;
3    httpReferer: string;
4    xTitle: string;
5    models: string[];
6    temperature: number;
7    provider: {
8      sort: "price" | "throughput" | "latency";
9      allowFallbacks: boolean;
10   };
11 };
12
13 const apiKey = process.env.OPENROUTER_API_KEY;
14 console.assert(apiKey, "OPENROUTER_API_KEY not set in the environment");
15
16 export const config: ModelConfig = {
17   apiKey: apiKey!,
...
21   models: ["arcee-ai/trinity-large-preview:free"],
22   temperature: 0.2,
23   provider: {
24     sort: "throughput",
25     allowFallbacks: true,
26   },
27 };
```

- **Linha 1-11 (`ModelConfig`)**: o mesmo padrão usado no projeto do módulo 1
  (`docs/curso-apis-ia-generativa/modulo01/project/01-openrouter/src/config.ts`) — um
  **tipo** que descreve todos os campos de configuração num lugar só, para o
  TypeScript avisar em tempo de compilação se algum campo estiver faltando ou com o
  tipo errado.
- **Linha 13-14**: lê a variável de ambiente e usa `console.assert` para **avisar**
  (não travar) se ela não estiver definida — um alerta no console em vez de uma
  exceção, para não derrubar o processo inteiro só por causa da configuração (a
  falha real só acontece mais adiante, quando a chamada à API de fato precisar da
  chave).
- **Linha 17 (`apiKey!`)**: o `!` é o operador de **asserção não-nula** do TypeScript
  — diz ao compilador "confie em mim, isso não vai ser `undefined` aqui", mesmo que o
  tipo de `apiKey` (linha 13) seja `string | undefined`. É um contrato que você
  assume conscientemente: se a variável de ambiente realmente não existir, o erro só
  aparece em runtime, na primeira chamada à API — não na hora de compilar.
- **Linha 21 (`models`)**: uma lista com **um** modelo gratuito que suporta
  `response_format` estruturado — o mesmo requisito citado no tutorial (Passo 3): nem
  todo modelo do OpenRouter aceita output estruturado, então essa lista precisa ser
  filtrada por essa capacidade na aba "Models" do OpenRouter.
- **Linha 23-25 (`provider`)**: instruções de **roteamento de modelo** que o
  OpenRouter usa para escolher entre provedores — `sort: "throughput"` prioriza o
  provedor mais rápido a responder, e `allowFallbacks: true` permite que o
  OpenRouter tente outro provedor automaticamente se o primeiro falhar.

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
25         provider: this.config.provider,
26       },
27     });
28   }
```

- **Linha 12-27 (`new ChatOpenAI(...)`)**: `ChatOpenAI` é a classe do
  `@langchain/openai` feita para falar com a API da OpenAI — e o **truque** aqui é
  que o OpenRouter expõe uma API compatível (linha 17, `baseURL`), então dá para
  reaproveitar essa mesma classe apontando para outro provedor.
- **Linha 19-20 (`HTTP-Referer` / `X-Title`)**: cabeçalhos específicos do OpenRouter
  (não da OpenAI) — aparecem no painel de uso do OpenRouter para identificar de qual
  aplicação veio a chamada.
- **Linha 23-26 (`modelKwargs`)**: campos que **não fazem parte** da API padrão da
  OpenAI, mas que o OpenRouter entende — é assim que a lista de modelos (para
  fallback automático) e as regras de roteamento chegam até a requisição HTTP real.

```typescript
30   async generateStructured<T extends z.ZodTypeAny>(
31     systemPrompt: string,
32     userPrompt: string,
33     schema: T,
34   ): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
35     try {
36       const structuredLlm = this.llmClient.withStructuredOutput(schema);
37       const data = await structuredLlm.invoke([
38         new SystemMessage(systemPrompt),
39         new HumanMessage(userPrompt),
40       ]);
41       return { success: true, data };
42     } catch (error) {
43       const message = error instanceof Error ? error.message : String(error);
44       return { success: false, error: message };
45     }
46   }
47 }
```

- **Linha 30 (`<T extends z.ZodTypeAny>`)**: um **generic** — esse método funciona
  com **qualquer** schema Zod que você passar (`IntentSchema`, `MessageSchema`, etc.),
  e o TypeScript infere automaticamente o tipo de retorno certo a partir do schema
  recebido, sem precisar escrever um método separado para cada um.
- **Linha 34 (tipo de retorno)**: um **union type discriminado** por `success` — em
  vez de deixar a exceção "vazar" para quem chamou, o método sempre devolve um
  objeto com `success: true` (e os dados) ou `success: false` (e o erro). Isso
  **obriga** quem chama (`identifyIntentNode`, `messageGeneratorNode`) a tratar os
  dois casos explicitamente, em vez de esquecer um `try/catch`.
- **Linha 36 (`withStructuredOutput(schema)`)**: o método do LangChain que faz o
  trabalho pesado — converte o schema Zod num JSON Schema, instrui o modelo (via
  `response_format` da API) a devolver **apenas** dados nesse formato, e já
  **valida** a resposta contra o schema antes de devolver. Sem isso, você precisaria
  pedir "responda em JSON" no prompt, torcer para o modelo obedecer, e ainda validar
  manualmente com `schema.parse(...)`.
- **Linha 37-40**: monta a conversa com duas mensagens — `SystemMessage` (as
  instruções/regras, que muda pouco entre chamadas) e `HumanMessage` (a pergunta
  específica) — é a mesma separação de papéis usada em qualquer chamada de chat a um
  LLM.

---

## `src/services/appointmentService.ts` — a "API real" simulada

```typescript
1  export type Professional = {
2    id: number;
3    name: string;
4    specialty: string;
5  };
...
14 export const professionals: Professional[] = [
15   { id: 1, name: "Dr. Alison Reis", specialty: "Cardiologia" },
16   { id: 2, name: "Dra. Carol Nogueira", specialty: "Dermatologia" },
17   { id: 3, name: "Dra. Beatriz Franco", specialty: "Neurologia" },
18 ];
19
20 const appointments: Appointment[] = [];
```

- **Linha 14-18 (`professionals`)**: uma lista fixa em memória — o "banco de dados"
  de profissionais que o prompt de `identifyIntentNode` usa para instruir a IA a
  combinar o nome citado pelo cliente com um `id` numérico.
- **Linha 20 (`appointments`)**: também em memória, e **fora** da classe
  `AppointmentService` — isso significa que os agendamentos persistem entre
  diferentes instâncias do serviço (mas somem quando o processo reinicia). É uma
  simplificação proposital para o exercício: numa API de verdade, isso seria uma
  tabela em banco de dados.

```typescript
33   async bookAppointment(input: {
34     professionalId: number;
35     dateTime: Date;
36     patientName: string;
37     reason: string;
38   }): Promise<Appointment> {
39     if (!this.isAvailable(input.professionalId, input.dateTime)) {
40       throw new Error("Horário indisponível para este profissional");
41     }
...
50   }
```

- **Linha 39-41**: a regra de negócio central — antes de agendar, **confere** se já
  não existe outro agendamento no mesmo profissional/horário. Se existir, lança uma
  exceção — que é justamente o que `scheduleNode` captura no seu `try/catch` para
  devolver `actionSuccess: false` em vez de derrubar a requisição inteira.
- Repare que `bookAppointment` e `cancelAppointment` são `async` mesmo trabalhando só
  com um array em memória — isso simula a **assinatura** de uma chamada real a um
  banco de dados ou API externa (que seria `async` de verdade), então trocar essa
  implementação por uma de verdade no futuro não exigiria mudar quem chama o
  serviço.

---

## `src/graph/prompts/identifyIntentPrompts.ts`

```typescript
1  import { professionals } from "../../services/appointmentService.ts";
2
3  export function getSystemPrompt(): string {
4    return JSON.stringify({
5      papel: "Classificador de intenção para uma clínica médica",
...
9      profissionais: professionals,
10     data_atual: new Date().toISOString(),
...
```

- **Linha 1**: o prompt **importa** a lista de profissionais do serviço de negócio,
  em vez de repetir os nomes na mão — se um profissional for adicionado em
  `appointmentService.ts`, o prompt já reflete isso automaticamente, sem precisar
  editar dois lugares.
- **Linha 4 (`JSON.stringify({...})`)**: o prompt inteiro é escrito como um **objeto
  JavaScript** e só convertido para string no final, em vez de um template de texto
  corrido. Isso deixa mais fácil de manter (autocomplete, refactor seguro de nomes de
  campo) e garante que a estrutura enviada ao modelo seja sempre um JSON
  sintaticamente válido.
- **Linha 10 (`data_atual`)**: é isso que permite ao modelo resolver expressões
  relativas como "hoje às 14h" ou "amanhã de manhã" — sem essa referência, a IA não
  teria como saber qual é o "hoje" do momento da chamada.
- Repare que o prompt inclui **exemplos** (`entrada`/`saida`) — essa técnica se chama
  **few-shot prompting**: mostrar 2-3 casos completos ensina o modelo o formato
  esperado de resposta muito melhor do que só descrever as regras em texto.

---

## `src/graph/identifyIntentNode.ts` — a IA decide a intenção

```typescript
1  import { z } from "zod";
2  import type { GraphState } from "./graph.ts";
3  import type { OpenRouterService } from "../openrouter-service.ts";
4  import { getSystemPrompt, getUserPrompt } from "./prompts/identifyIntentPrompts.ts";
5
6  // OpenRouter/OpenAI exigem, em modo de output estruturado estrito, que campos
7  // opcionais também sejam `.nullable()` — só `.optional()` não é suportado.
8  export const IntentSchema = z.object({
9    intent: z.enum(["schedule", "cancel", "unknown"]),
10   professionalId: z.number().nullable().optional(),
11   professionalName: z.string().nullable().optional(),
12   dateTime: z.string().nullable().optional(),
13   patientName: z.string().nullable().optional(),
14   reason: z.string().nullable().optional(),
15 });
```

- **Linhas 6-14**: essa é uma correção sobre o que o tutorial mostra literalmente —
  ao rodar o projeto de verdade contra a API (modo de **structured outputs** estrito
  da OpenAI/OpenRouter), campos com só `.optional()` disparam o erro `Zod field ...
  uses .optional() without .nullable() which is not supported by the API`. O motivo:
  nesse modo estrito, **todo** campo do JSON Schema precisa aparecer como
  `"required"`, e a única forma de simular "campo opcional" é permitir `null` como
  valor válido (`.nullable()`) — em vez de omitir o campo (`.optional()` sozinho).
  Encadear os dois (`.nullable().optional()`) cobre as duas situações: o modelo pode
  devolver `null` (aceito pela API estrita) ou simplesmente não popular o campo em
  TypeScript.

```typescript
17 export function createIdentifyIntentNode(llmClient: OpenRouterService) {
18   return async function identifyIntentNode(state: GraphState): Promise<Partial<GraphState>> {
19     const lastMessage = state.messages.at(-1);
20     const input = lastMessage?.text ?? "";
21
22     const systemPrompt = getSystemPrompt();
23     const userPrompt = getUserPrompt(input);
24
25     const result = await llmClient.generateStructured(systemPrompt, userPrompt, IntentSchema);
26
27     if (!result.success) {
28       console.error("erro ao identificar intenção", result.error);
29       return { intent: "unknown", actionError: result.error };
30     }
31
32     console.log("intenção identificada:", result.data.intent);
33     return { ...result.data };
34   };
35 }
```

- **Linha 17 (`createIdentifyIntentNode`)**: essa é uma **factory de nó** — em vez de
  exportar a função do nó diretamente (como no módulo 2), aqui ela recebe primeiro
  a dependência (`llmClient`) e só depois devolve a função que o LangGraph vai
  chamar. É assim que o nó "recebe" um serviço externo sem precisar de uma variável
  global — o mesmo princípio de **injeção de dependência** via factory que aparece
  em `factory.ts` (para o Studio) e em `tests/graph.test.ts` (para os testes, que
  instanciam seus próprios serviços).
- **Linha 18 (`Promise<Partial<GraphState>>`)**: repare a diferença do módulo 2 —
  lá, cada nó devolvia o **estado inteiro** (`GraphState`, com spread manual). Aqui,
  o nó devolve só um **pedaço** do estado (`Partial<GraphState>`, os campos que ele
  de fato alterou). É o próprio LangGraph quem funde esse retorno parcial com o
  estado acumulado (usando o schema Zod definido em `graph.ts`) — menos código
  boilerplate de spread em cada nó.
- **Linha 27-30**: se a chamada à IA falhar (rede, autenticação, schema rejeitado
  pela API), o nó **não deixa a exceção estourar** — ele decide, de propósito, cair
  no caminho `intent: "unknown"`. Isso significa que uma falha de infraestrutura
  vira uma resposta educada ("não entendi o que você quis dizer") em vez de um erro
  500 cru para o cliente final.
- **Linha 33 (`{ ...result.data }`)**: espalha os campos do objeto validado
  (`intent`, `professionalId`, etc.) diretamente no retorno parcial — como
  `result.data` já tem exatamente o formato de `IntentSchema` (que é um subconjunto
  de `GraphState`), não precisa remapear campo por campo.

---

## `src/graph/scheduleNode.ts` e `cancelNode.ts` — confio, mas confiro

```typescript
1  import { z } from "zod";
2  import type { GraphState } from "./graph.ts";
3  import type { AppointmentService } from "../services/appointmentService.ts";
4
5  const ScheduleRequiredSchema = z.object({
6    professionalId: z.number(),
7    dateTime: z.string(),
8    patientName: z.string(),
9  });
10
11 export function createScheduleNode(appointmentService: AppointmentService) {
12   return async function scheduleNode(state: GraphState): Promise<Partial<GraphState>> {
13     const validation = ScheduleRequiredSchema.safeParse(state);
14
15     if (!validation.success) {
16       const errorMessages = validation.error.errors.map((e) => e.message).join(", ");
17       return { actionSuccess: false, actionError: errorMessages };
18     }
```

- **Linha 5-9 (`ScheduleRequiredSchema`)**: um schema **diferente** do `IntentSchema`
  — aqui os três campos são **obrigatórios** (sem `.optional()`), porque, para
  agendar de verdade, esses dados **precisam** existir. Repare que este schema é
  interno ao arquivo (não exportado): só serve para essa validação local.
  Diferente de `IntentSchema` (que descreve o **output esperado da IA**), este
  schema descreve os **requisitos de negócio** deste nó específico — são
  preocupações diferentes, por isso são schemas separados.
- **Linha 13 (`.safeParse(state)`)**: diferente de `.parse(...)` (que lança
  exceção se a validação falhar), `safeParse` devolve um objeto
  `{ success: true, data }` ou `{ success: false, error }` — o mesmo padrão de
  "resultado explícito" já visto em `generateStructured`. Isso permite tratar a
  falha de validação como um **caminho normal** do código (linhas 15-17), não como
  uma exceção a capturar.
- Este é o princípio de **"confio, mas confiro"** citado no tutorial: mesmo que
  `identifyIntentNode` já tenha extraído e validado (via `IntentSchema`) os dados na
  etapa anterior, este nó **revalida** com seu próprio schema antes de agir —
  tratando cada nó como se fosse um microsserviço independente, que nunca confia
  cegamente no que a etapa anterior devolveu. Se um dia `identifyIntentNode` for
  reescrito com um bug que deixa `professionalId` vazio passar, é este nó — e não o
  anterior — quem barra a ação antes que ela chegue ao `appointmentService`.

```typescript
19     try {
20       const appointment = await appointmentService.bookAppointment({
21         professionalId: validation.data.professionalId,
22         dateTime: new Date(validation.data.dateTime),
23         patientName: validation.data.patientName,
24         reason: state.reason ?? "consulta geral",
25       });
26
27       return { actionSuccess: true, ...appointment };
28     } catch (error) {
29       const message = error instanceof Error ? error.message : String(error);
30       return { actionSuccess: false, actionError: message };
31     }
32   };
33 }
```

- **Linha 22 (`new Date(validation.data.dateTime)`)**: converte a string ISO (que
  veio da IA, via `IntentSchema.dateTime`) para um objeto `Date` de verdade — é
  esse objeto que `appointmentService.bookAppointment` usa para comparar horários e
  checar disponibilidade.
- **Linha 24 (`state.reason ?? "consulta geral"`)**: `reason` é opcional em
  `IntentSchema` — se o cliente não mencionar o motivo da consulta, este valor
  padrão entra no lugar, em vez de mandar `undefined` para o serviço.
- **Linha 28-31**: mesmo padrão de "capturar e converter em resultado", já visto em
  `openrouter-service.ts` — se `bookAppointment` lançar (por exemplo, horário
  indisponível), o nó não quebra o grafo inteiro, só marca `actionSuccess: false`
  com a mensagem do erro.

`cancelNode.ts` segue exatamente a mesma estrutura — troca `bookAppointment` por
`cancelAppointment` (que não devolve dados, só confirma a remoção) e não precisa do
campo `reason`.

---

## `src/graph/prompts/messageGeneratorPrompts.ts` e `messageGeneratorNode.ts`

```typescript
1  import { z } from "zod";
2  import { AIMessage } from "@langchain/core/messages";
3  import type { GraphState } from "./graph.ts";
4  import type { OpenRouterService } from "../openrouter-service.ts";
5  import { getSystemPrompt, getUserPrompt } from "./prompts/messageGeneratorPrompts.ts";
6
7  const MessageSchema = z.object({ message: z.string() });
8
9  export function createMessageGeneratorNode(llmClient: OpenRouterService) {
10   return async function messageGeneratorNode(state: GraphState): Promise<Partial<GraphState>> {
11     const scenario = `${state.intent ?? "unknown"}_${state.actionSuccess ? "success" : "error"}`;
12     const details = {
13       professionalName: state.professionalName,
14       dateTime: state.dateTime,
15       patientName: state.patientName,
16       error: state.actionError,
17     };
```

- **Linha 7 (`MessageSchema`)**: o schema mais simples do projeto — só um campo de
  texto. Mesmo assim, passar por `withStructuredOutput` garante que o modelo sempre
  devolva exatamente `{ message: "..." }`, nunca um texto solto ou markdown
  inesperado que quebraria `result.data.message` na linha seguinte.
- **Linha 11 (`scenario`)**: monta uma string como `"schedule_success"` ou
  `"cancel_error"` — combinando a intenção identificada com o resultado da ação. É
  esse valor que o prompt (`messageGeneratorPrompts.ts`) usa para escolher o "tom"
  certo de resposta (confirmação, desculpa, redirecionamento) sem precisar de um
  `if/else` gigante no código — a lógica de "qual mensagem gerar para qual cenário"
  fica **inteira** dentro do prompt, como texto para o modelo interpretar.
- **Linha 12-17 (`details`)**: um objeto com só os campos relevantes para a
  mensagem — nomes e datas, mas também `error` (que só terá valor quando a ação
  falhou). O prompt usa isso para preencher os detalhes concretos na mensagem
  gerada (ex: "sua consulta com o **Dr. Alison Reis** foi confirmada").

```typescript
19     const result = await llmClient.generateStructured(systemPrompt, userPrompt, MessageSchema);
20
21     if (!result.success) {
22       return { messages: [...state.messages, new AIMessage("Desculpe, ocorreu um erro.")] };
23     }
24
25     return { messages: [...state.messages, new AIMessage(result.data.message)] };
26   };
27 }
```

- **Linha 21-23**: se **esta segunda** chamada de IA falhar (depois que
  `identifyIntent`, e possivelmente `scheduleNode`/`cancelNode`, já rodaram com
  sucesso), o usuário ainda recebe uma resposta — só que uma mensagem de erro
  genérica fixa, em vez de travar a requisição inteira por causa de uma falha na
  "camada de redação" da resposta.
- **Linha 22 e 25 (`[...state.messages, new AIMessage(...)]`)**: este é o **único**
  lugar do grafo onde `messages` cresce — mesmo papel do `chatResponseNode` no
  módulo 2, só que agora acoplado à geração da mensagem, porque as duas coisas
  (gerar o texto e embrulhar numa `AIMessage`) sempre acontecem juntas aqui.

---

## `src/graph/graph.ts` — o coração do grafo

```typescript
1  import { StateGraph, START, END } from "@langchain/langgraph";
2  import type { BaseMessage } from "@langchain/core/messages";
3  import { z } from "zod";
...
10 const GraphStateSchema = z.object({
11   messages: z.custom<BaseMessage[]>().default(() => []),
12   intent: z.enum(["schedule", "cancel", "unknown"]).optional(),
13   professionalId: z.number().optional(),
14   professionalName: z.string().optional(),
15   dateTime: z.string().optional(),
16   patientName: z.string().optional(),
17   reason: z.string().optional(),
18   actionSuccess: z.boolean().optional(),
19   actionError: z.string().optional(),
20 });
21
22 export type GraphState = z.infer<typeof GraphStateSchema>;
```

- **Linha 10-20 (`GraphStateSchema`)**: diferente do módulo 2 (`Annotation.Root`,
  por causa da versão pinada da lib), aqui o estado é definido **exatamente como o
  tutorial ensina** — um `z.object({...})` comum, passado direto para
  `new StateGraph(...)` (linha 25 abaixo). Isso só funciona porque este projeto usa
  uma versão atual do `@langchain/langgraph`, que já tem suporte nativo a Zod — sem
  precisar de `Annotation.Root` nem de reducers manuais.
- **Linha 11 (`z.custom<BaseMessage[]>().default(() => [])`)**: `z.custom<T>()` cria
  um "escape hatch" no Zod — diz "aceite qualquer coisa aqui, eu garanto o tipo `T`
  manualmente" (Zod não tem uma forma nativa de descrever a classe `BaseMessage` do
  LangChain). `.default(() => [])` é o equivalente, em Zod, ao `default: () => []`
  que o módulo 2 escrevia com `Annotation` — o valor inicial de `messages` se
  ninguém informar nada.
- **Linha 12-19**: repare que **todos** os campos de dados extraídos são
  `.optional()` aqui (sem `.nullable()`) — porque este schema descreve o **estado
  interno do grafo**, não um output que vai direto para a API estrita da OpenAI
  (essa exigência de `.nullable()` só se aplica ao `IntentSchema`, que é passado
  para `withStructuredOutput`). São dois schemas com propósitos diferentes, mesmo
  compartilhando quase os mesmos nomes de campo.
- **Linha 22 (`z.infer<typeof GraphStateSchema>`)**: extrai o tipo TypeScript
  automaticamente a partir do schema Zod — o mesmo papel que
  `typeof GraphAnnotation.State` cumpria no módulo 2, só que pela via nativa do Zod.

```typescript
24 function routeByIntent(state: GraphState): string {
25   switch (state.intent) {
26     case "schedule":
27       return "scheduleNode";
28     case "cancel":
29       return "cancelNode";
30     default:
31       return "messageGeneratorNode";
32   }
33 }
```

- Mesma ideia do `routeByCommand` do módulo 2: uma função que **não é um nó**, só
  examina o estado e devolve o **nome** do próximo nó. O `default` cobre tanto
  `"unknown"` quanto qualquer falha em que `intent` nunca tenha sido preenchido —
  levando direto para `messageGeneratorNode`, que sabe gerar uma mensagem adequada
  mesmo sem uma ação de agendamento/cancelamento por trás.

```typescript
35 export function buildGraph(llmClient: OpenRouterService, appointmentService: AppointmentService) {
36   const workflow = new StateGraph(GraphStateSchema)
37     .addNode("identifyIntent", createIdentifyIntentNode(llmClient))
38     .addNode("scheduleNode", createScheduleNode(appointmentService))
39     .addNode("cancelNode", createCancelNode(appointmentService))
40     .addNode("messageGeneratorNode", createMessageGeneratorNode(llmClient))
41     .addEdge(START, "identifyIntent")
42     .addConditionalEdges("identifyIntent", routeByIntent, {
43       scheduleNode: "scheduleNode",
44       cancelNode: "cancelNode",
45       messageGeneratorNode: "messageGeneratorNode",
46     })
47     .addEdge("scheduleNode", "messageGeneratorNode")
48     .addEdge("cancelNode", "messageGeneratorNode")
49     .addEdge("messageGeneratorNode", END);
50
51   return workflow.compile();
52 }
```

- **Linha 35 (`buildGraph(llmClient, appointmentService)`)**: diferente do módulo 2
  (`buildGraph()`, sem argumentos, que criava tudo internamente), aqui a fábrica
  **recebe as dependências de fora** — é o princípio de injeção de dependência: quem
  monta o grafo (`factory.ts` para o Studio, `tests/graph.test.ts` para os testes)
  decide **quais instâncias** de `OpenRouterService`/`AppointmentService` usar, sem
  `graph.ts` precisar saber como essas classes são construídas.
- **Linha 37 e 40**: só `identifyIntent` e `messageGeneratorNode` recebem
  `llmClient` — são os únicos dois nós que efetivamente **chamam a IA**.
  `scheduleNode` e `cancelNode` (linhas 38-39) recebem só `appointmentService`,
  porque eles apenas processam dados já extraídos e falam com o "banco de dados" —
  cada nó só conhece a dependência que realmente precisa.
- **Linha 47-48**: tanto `scheduleNode` quanto `cancelNode` convergem para
  `messageGeneratorNode` — não importa qual ação foi executada (ou se falhou), a
  etapa final é sempre a mesma: transformar o resultado técnico numa mensagem para
  o cliente.

---

## `src/graph/factory.ts`

```typescript
1  import { buildGraph } from "./graph.ts";
2  import { OpenRouterService } from "../openrouter-service.ts";
3  import { AppointmentService } from "../services/appointmentService.ts";
4
5  export const graph = buildGraph(new OpenRouterService(), new AppointmentService());
```

- **Linha 5**: diferente do `factory.ts` do módulo 2 (`buildGraph()`, sem
  parâmetros), aqui é preciso **instanciar de verdade** as duas dependências antes
  de montar o grafo — porque `buildGraph` agora as exige como argumentos. Esta é a
  única peça do projeto que efetivamente "liga os fios": cria os serviços reais e
  monta o grafo pronto para o LangGraph Studio (via `langgraph.json`) encontrar sob
  o nome `graph`.

---

## `src/server.ts` — a rota HTTP `/chat`

```typescript
1  import Fastify from "fastify";
2  import { HumanMessage } from "@langchain/core/messages";
3  import type { CompiledStateGraph } from "@langchain/langgraph";
4  import type { GraphState } from "./graph/graph.ts";
5
6  export function createServer(graph: CompiledStateGraph<GraphState, Partial<GraphState>, any>) {
7    const app = Fastify();
...
```

- **Linha 6 (`createServer(graph)`)**: a diferença mais visível em relação ao
  módulo 2 — lá, `createServer()` **montava** o grafo internamente
  (`buildGraph()`); aqui, o grafo já vem **pronto** de fora, como parâmetro. Isso é
  o que permite ao teste (`tests/graph.test.ts`) passar um grafo com suas próprias
  instâncias de serviço, sem duplicar a lógica de montagem em dois lugares.
- **Linha 3 (`CompiledStateGraph<...>`)**: o tipo do objeto que `workflow.compile()`
  devolve em `graph.ts` — anotar esse tipo aqui é o que garante que, se alguém
  passar algo que não seja um grafo compilado de verdade, o TypeScript acuse o erro
  antes mesmo de rodar.

```typescript
19     const result = await graph.invoke({
20       messages: [new HumanMessage(question)],
21     });
22
23     reply.send({
24       intent: result.intent,
25       actionSuccess: result.actionSuccess,
26       actionError: result.actionError,
27       message: result.messages.at(-1)?.text ?? "",
28     });
```

- **Linha 23-27**: diferente do módulo 2 (que mandava só `response.output`, uma
  string simples), aqui a resposta é um **objeto JSON** com vários campos do estado
  final — porque agora existe informação útil além do texto: se a ação teve
  sucesso, qual foi a intenção identificada, e o texto da última mensagem gerada
  (`result.messages.at(-1)?.text`). Isso é o que permite ao teste checar
  `body.intent === "schedule"` sem precisar fazer parsing de linguagem natural.

---

## `src/index.ts`

```typescript
1  import { createServer } from "./server.ts";
2  import { graph } from "./graph/factory.ts";
3
4  const app = createServer(graph);
5  await app.listen({ port: 3000, host: "localhost" });
```

- **Linha 2 e 4**: agora que `createServer` exige um grafo pronto (veja acima), o
  ponto de entrada importa o grafo já montado de `factory.ts` (a mesma instância que
  o LangGraph Studio usaria) e passa para o servidor — garantindo que a API HTTP e
  o Studio rodem exatamente o mesmo grafo, sem duas implementações divergentes.

---

## `tests/graph.test.ts`

```typescript
1  import { test } from "node:test";
2  import assert from "node:assert";
3  import { createServer } from "../src/server.ts";
4  import { buildGraph } from "../src/graph/graph.ts";
5  import { OpenRouterService } from "../src/openrouter-service.ts";
6  import { AppointmentService } from "../src/services/appointmentService.ts";
7
8  test("agenda uma consulta com sucesso", async () => {
9    const llmClient = new OpenRouterService();
10   const appointmentService = new AppointmentService();
11   const app = createServer(buildGraph(llmClient, appointmentService));
...
```

- **Linhas 9-11**: cada teste cria **suas próprias instâncias** de
  `OpenRouterService` e `AppointmentService`, e monta um grafo novo a partir delas —
  igual ao módulo 2 (`createServer()` isolado por teste), só que agora o passo
  extra de instanciar os serviços fica explícito no teste, em vez de escondido
  dentro de `createServer`.
- O segundo teste (`cancela uma consulta existente`) primeiro **agenda** uma
  consulta e só depois tenta cancelá-la — porque `cancelNode` só encontra um
  agendamento para cancelar se ele existir de verdade no array em memória de
  `appointmentService.ts`. Repare que os dois `app.inject(...)` dessa função usam o
  **mesmo** `appointmentService` (linha 10, reaproveitado no `buildGraph` de cada
  chamada) — se cada chamada criasse um serviço novo, o cancelamento nunca
  encontraria o agendamento feito na chamada anterior.
- O terceiro teste (`pergunta fora do escopo`) é o único que **não depende** de uma
  chave de API real funcionar perfeitamente: mesmo que a chamada de IA falhe por
  falta de credenciais, `identifyIntentNode` já cai em `intent: "unknown"` (seu
  próprio tratamento de erro) — e é exatamente esse valor que o teste espera. Os
  outros dois testes, que esperam `"schedule"`/`"cancel"`, só passam de fato com uma
  `OPENROUTER_API_KEY` válida no `.env`.

---

## Decisões de projeto que complementam o tutorial

### 1. `.nullable()` além de `.optional()` no `IntentSchema`

O tutorial mostra `IntentSchema` só com `.optional()` nos campos extraídos. Ao rodar
o projeto contra a API real do OpenRouter (modo de **structured outputs** estrito),
essa combinação falha com o erro citado na seção de `identifyIntentNode.ts` acima.
Isso não é uma peculiaridade deste projeto — é um requisito documentado da OpenAI
para o modo estrito (todo campo do JSON Schema tem que ser `"required"`; a forma de
simular "campo opcional" é aceitar `null` como valor). A correção foi acrescentar
`.nullable()` a cada campo opcional do `IntentSchema` — sem mudar nenhuma outra
lógica do grafo.

### 2. Dependências atualizadas, em vez de pinadas

Ao contrário do módulo 2 (que manteve versões antigas com vulnerabilidades
conhecidas, por serem as versões literalmente citadas pelo tutorial daquela aula),
este projeto foi montado direto com as versões mais recentes de
`@langchain/langgraph`, `@langchain/openai`, `@langchain/core` e `zod` disponíveis
no momento — `npm audit` não acusa nenhuma vulnerabilidade. Isso só foi possível
porque a API que o tutorial ensina (schema Zod direto em `new StateGraph(...)`) já é
suportada nativamente nessas versões atuais — não foi necessário nenhum ajuste de
compatibilidade como o `Annotation.Root` do módulo 2.

## Verifique seu entendimento

1. Por que `ScheduleRequiredSchema` (em `scheduleNode.ts`) declara os mesmos três
   campos que `IntentSchema` já validou em `identifyIntentNode`, em vez de confiar
   que esses dados já chegaram corretos?
2. Qual é a diferença prática entre `.optional()` sozinho e `.nullable().optional()`
   num campo de `IntentSchema`, e por que essa diferença só importa para esse
   schema (e não para `GraphStateSchema`, em `graph.ts`)?
3. Por que `identifyIntentNode` e `messageGeneratorNode` recebem `llmClient` como
   dependência, mas `scheduleNode` e `cancelNode` recebem `appointmentService`?
4. No teste "cancela uma consulta existente", o que aconteceria se cada chamada a
   `app.inject(...)` usasse uma instância nova de `AppointmentService`, em vez de
   reaproveitar a mesma?
5. O que `withStructuredOutput(schema)` evita que você teria que fazer manualmente
   se estivesse só pedindo "responda em JSON" no prompt, sem essa função?
