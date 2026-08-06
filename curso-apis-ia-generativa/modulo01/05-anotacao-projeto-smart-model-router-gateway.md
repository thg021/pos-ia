---
title: "Anotação: explicação linha a linha do projeto smart-model-router-gateway"
modulo: 1
aula: 3-4
tipo: anotacao
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [nodejs, typescript, fastify, openrouter, explicacao-linha-a-linha]
fonte: docs/Projetos/01-openrouter (projeto implementado a partir de modulo01/03-tutorial-openrouter-fastify-typescript.md e modulo01/04-tutorial-openrouter-service-e-testes.md)
---
# Anotação: explicação linha a linha do projeto `01-openrouter`

Este documento explica, arquivo por arquivo e linha por linha, o projeto criado em
`docs/Projetos/01-openrouter/` — a API que expõe uma rota `/chat` conectada à OpenRouter.
A ideia é que você consiga voltar aqui a qualquer momento e entender **por que** cada linha
existe, não só **o que** ela faz.

## Visão geral: como as peças se conectam

Antes de entrar linha a linha, vale ter o mapa mental de quem chama quem:

```
index.ts  →  cria o OpenRouterService e o server, e sobe a API
   │
   ├── server.ts  →  define a rota HTTP /chat (usa Fastify)
   │       │
   │       └── chama routerService.generate(question)
   │
   └── openrouter-service.ts  →  fala com a API da OpenRouter (usa o SDK "openai")
           │
           └── lê as configurações de config.ts
```

`config.ts` é lido por todo mundo; `server.ts` não sabe nada sobre OpenRouter, só sabe
que existe "um serviço com um método `generate`" — isso é proposital (ver seção sobre
`server.ts` mais abaixo).

---

## `package.json` — a "carteira de identidade" do projeto

```json
1  {
2    "name": "01-openrouter",
3    "version": "1.0.0",
4    "description": "Smart Model Router Gateway - API Fastify integrada ao OpenRouter (modulo 01 do curso APIs de IA Generativa)",
5    "main": "src/index.ts",
6    "type": "module",
7    "scripts": {
8      "dev": "node --env-file .env --watch src/index.ts",
9      "test": "node --env-file .env --test tests/**/*.test.ts"
10   },
...
14   "dependencies": {
15     "fastify": "^5.10.0",
16     "openai": "^6.48.0"
17   },
18   "devDependencies": {
19     "@types/node": "^24.13.3"
20   }
21 }
```

- **Linha 1-4**: metadados. `name`, `version`, `description` não afetam o funcionamento —
  são só documentação para quem abrir o projeto.
- **Linha 5 (`main`)**: diz qual arquivo é o "ponto de entrada" do pacote, caso outro
  projeto importasse este como dependência. Não é usado pelos scripts abaixo.
- **Linha 6 (`"type": "module"`)**: isso é importante. Node.js tem dois sistemas de
  módulos: o antigo **CommonJS** (`require("modulo")`) e o moderno **ES Modules**
  (`import algo from "modulo"`). Com `"type": "module"`, todo arquivo `.js`/`.ts` do
  projeto é tratado como ES Module — por isso podemos usar `import`/`export` em vez de
  `require`/`module.exports` nos arquivos de `src/`.
- **Linha 8 (`dev`)**: o comando que você roda com `npm run dev`. Duas *flags* nativas do
  Node (nenhuma dependência externa precisa ser instalada para isso):
  - `--env-file .env`: lê o arquivo `.env` e transforma cada linha `CHAVE=valor` em
    variável de ambiente (`process.env.CHAVE`), *antes* do código rodar.
  - `--watch`: fica de olho nos arquivos do projeto e reinicia o processo sozinho toda
    vez que você salva uma alteração — sem isso, você teria que parar (`Ctrl+C`) e
    rodar de novo manualmente a cada mudança.
  - Repare que `src/index.ts` é passado direto, sem nenhum "build" antes. O Node 24
    interpreta arquivos `.ts` nativamente (ignora as anotações de tipo em tempo de
    execução) — não existe um arquivo `.js` gerado em nenhum lugar.
- **Linha 9 (`test`)**: mesma ideia, mas usando `--test` (o *test runner* nativo do
  Node) apontando para todo arquivo que termine em `.test.ts` dentro de `tests/`.
- **Linha 15-16 (`dependencies`)**: bibliotecas que o código *precisa* para rodar:
  - `fastify`: o framework que cria o servidor HTTP e as rotas.
  - `openai`: o SDK (biblioteca cliente) oficial da OpenAI — usamos ele aqui porque a
    OpenRouter é compatível com o formato de API da OpenAI (mais detalhes na seção do
    `openrouter-service.ts`).
  - O símbolo `^` antes da versão (ex: `^5.10.0`) significa "aceita atualizações de
    versão que não quebrem compatibilidade" (mesma versão principal/major).
- **Linha 19 (`devDependencies`)**: `@types/node` só dá **tipos** (`process.env`,
  `console`, etc.) para o editor entender o ambiente Node durante a escrita do código —
  não é usado quando o programa roda de verdade.

---

## `tsconfig.json` — como o editor deve entender os tipos

```json
1  {
2    "compilerOptions": {
3      "target": "ES2022",
4      "module": "ESNext",
...
10     "noEmit": true,
...
13     "strict": true,
```

- **`target: "ES2022"`**: diz "pode usar recursos de JavaScript até a versão ES2022"
  (ex: `?.` optional chaining, `??` nullish coalescing — ambos usados no
  `openrouter-service.ts`).
- **`module: "ESNext"` / `moduleResolution: "bundler"`**: como o TypeScript deve
  resolver os `import`. `"bundler"` é o modo pensado para ferramentas modernas, e é o
  que permite `allowImportingTsExtensions: true` (linha 9) — ou seja, escrever
  `import { config } from "./config.ts"` com o `.ts` no final, do jeito que o Node 24
  exige quando roda TypeScript direto (sem essa opção, o TypeScript reclamaria do
  `.ts` no caminho do import).
- **`noEmit: true`**: "não gere nenhum arquivo de saída". Esse `tsconfig.json` serve
  **só para o editor** (VS Code) checar tipos e dar autocomplete — quem realmente
  executa o código é o Node, direto do `.ts`, como vimos no `package.json`.
- **`strict: true`**: liga o modo mais rigoroso de checagem de tipos do TypeScript
  (por exemplo, não deixa uma variável ser `undefined` sem avisar). É o que faz o
  `apiKey!` em `config.ts` (linha 20) ser necessário — sem `strict`, o TypeScript nem
  reclamaria.

---

## `.env` e `.env.example` — segredo vs. documentação

```
OPENROUTER_API_KEY=your-api-key-here
```

- `.env.example` é **versionado** (vai para o Git) e serve de documentação: "este
  projeto precisa dessa variável de ambiente, aqui está o formato esperado".
- `.env` (sem `.example`) é onde fica a chave **real**. Ele está no `.gitignore` do
  repositório (regra `.env` + `.env.*` + `!.env.example` — a exclamação significa
  "exceto este"), então nunca é commitado por acidente.
- O Node só lê esse arquivo por causa da flag `--env-file .env` que vimos no
  `package.json`.

---

## `src/config.ts` — um único lugar para toda configuração

```typescript
1  export type ModelConfig = {
2    apiKey: string;
3    httpReferer: string;
4    xTitle: string;
5    port: number;
6    models: string[];
7    temperature: number;
8    maxTokens: number;
9    systemPrompt: string;
10   provider: {
11     sort: "price" | "throughput" | "latency";
12     allowFallbacks: boolean;
13   };
14 };
```

- **Linha 1**: `type ModelConfig` é um "molde" (tipo TypeScript) descrevendo o formato
  exato que um objeto de configuração precisa ter. Isso não existe em tempo de
  execução — é só uma checagem que o TypeScript faz **enquanto você escreve o código**,
  para avisar se algum campo estiver faltando ou com o tipo errado.
- **Linha 11**: `"price" | "throughput" | "latency"` é um **union type** — significa
  "essa propriedade só pode valer exatamente uma dessas três strings", nada mais. Se
  você tentar atribuir `"barato"`, o TypeScript recusa antes mesmo de rodar.

```typescript
16 const apiKey = process.env.OPENROUTER_API_KEY;
17 console.assert(apiKey, "OPENROUTER_API_KEY not set in the environment");
```

- **Linha 16**: `process.env` é o objeto onde o Node guarda todas as variáveis de
  ambiente (as que o `--env-file .env` carregou, mais as do sistema operacional).
  Nesse ponto, `apiKey` tem o tipo `string | undefined` — porque o TypeScript não tem
  como garantir, só olhando o código, que essa variável de ambiente existe de verdade.
- **Linha 17**: `console.assert(condicao, mensagem)` imprime a mensagem de erro **se**
  a condição for falsa (aqui: se `apiKey` for `undefined` ou string vazia). É uma
  forma simples de "falhar de forma visível" cedo, em vez de deixar o erro estourar
  escondido lá na hora de chamar a API da OpenRouter. Importante: `console.assert`
  **não para a execução** — só imprime um aviso no console. Quem realmente quisesse
  interromper o programa usaria `throw new Error(...)` em vez disso.

```typescript
19 export const config: ModelConfig = {
20   apiKey: apiKey!,
```

- **Linha 20**: o `!` depois de `apiKey` é o **non-null assertion operator**. Ele diz
  ao TypeScript "confia em mim, eu sei que isso não é `undefined` aqui" — convertendo
  o tipo de `string | undefined` para só `string`. É uma promessa manual do
  programador; se a promessa for falsa (a variável realmente não existir), o erro só
  vai aparecer mais tarde, quando o valor `undefined` for usado onde se esperava uma
  string.

```typescript
26 models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-26b-a4b-it:free"],
```

- Essa lista é o que a OpenRouter chama de **model routing**: em vez de fixar um
  único modelo, você dá uma lista ordenada de preferência. Se o primeiro modelo
  estiver indisponível (ou não aceitar o pedido), a OpenRouter tenta o próximo da
  lista — desde que `allowFallbacks` permita isso (ver abaixo).

```typescript
30 provider: {
31   sort: "price",
32   allowFallbacks: false,
33 },
```

- `sort: "price"` pede à OpenRouter para escolher, entre os provedores disponíveis
  para aquele modelo, o mais barato.
- `allowFallbacks: false` diz "se o modelo/provedor escolhido falhar, **não** tente
  outro automaticamente — devolva o erro". Colocar `true` faria a OpenRouter tentar
  os próximos modelos da lista `models` em caso de falha.

---

## `src/openrouter-service.ts` — a peça que fala com a OpenRouter

```typescript
1  import OpenAI from "openai";
2  import { type ModelConfig, config as defaultConfig } from "./config.ts";
```

- **Linha 1**: importa a classe `OpenAI` do SDK oficial da OpenAI. Achamos estranho
  usar um SDK "da OpenAI" para falar com a "OpenRouter"? A explicação está na próxima
  seção de decisões de projeto, mas o resumo é: a OpenRouter **imita** a API HTTP da
  OpenAI de propósito, então qualquer cliente feito para a OpenAI funciona com a
  OpenRouter, bastando trocar o endereço do servidor (`baseURL`).
- **Linha 2**: `import { type ModelConfig, config as defaultConfig }` faz duas coisas
  na mesma linha:
  - `type ModelConfig`: importa **só o tipo** (não existe em tempo de execução, é
    descartado quando o TypeScript checa e o Node roda).
  - `config as defaultConfig`: importa o valor `config` (o objeto de configuração
    real, exportado em `config.ts`) e dá um **apelido** (`as defaultConfig`) para
    evitar conflito de nome com o parâmetro `config` que aparece mais abaixo.

```typescript
9  export class OpenRouterService {
10   private client: OpenAI;
11   private config: ModelConfig;
```

- **Linha 9**: `class` é um molde para criar objetos que agrupam dados (`client`,
  `config`) com comportamento (`generate`). Pense nele como "uma máquina que sabe
  conversar com a OpenRouter": você monta a máquina uma vez (com `new
  OpenRouterService()`), e depois só chama `.generate(pergunta)` quantas vezes quiser.
- **Linha 10-11**: `private` significa que `client` e `config` só podem ser lidos ou
  alterados **de dentro da própria classe** — código de fora (como `server.ts`) não
  tem acesso direto a eles, só pode usar o método público `generate`.

```typescript
13 constructor(configOverride?: Partial<ModelConfig>) {
14   this.config = { ...defaultConfig, ...configOverride };
```

- **Linha 13**: o `constructor` é o código que roda automaticamente quando alguém
  escreve `new OpenRouterService(...)`. O parâmetro `configOverride` é **opcional**
  (o `?`) e do tipo `Partial<ModelConfig>` — `Partial<T>` é um tipo utilitário do
  TypeScript que pega um tipo `T` e torna **todos os campos opcionais**. Ou seja:
  você pode passar só `{ provider: { sort: "throughput", allowFallbacks: false } }`
  sem precisar repetir `apiKey`, `models`, etc. Isso é exatamente o que os testes
  fazem (ver `tests/router-service.test.ts`).
- **Linha 14**: `{ ...defaultConfig, ...configOverride }` usa o **spread operator**
  (`...`) para criar um objeto novo copiando primeiro todos os campos de
  `defaultConfig`, e depois **sobrescrevendo** com os campos de `configOverride` (se
  algum vier). Como o `provider` inteiro seria sobrescrito de uma vez (não faz um
  merge campo a campo dentro de `provider`), os testes precisam espalhar
  (`...config.provider`) o `provider` original também, senão perderiam `allowFallbacks`.

```typescript
15   this.client = new OpenAI({
16     apiKey: this.config.apiKey,
17     baseURL: "https://openrouter.ai/api/v1",
18     defaultHeaders: {
19       "HTTP-Referer": this.config.httpReferer,
20       "X-Title": this.config.xTitle,
21     },
22   });
```

- **Linha 17 (`baseURL`)**: é aqui que a "mágica" acontece — em vez de o SDK da
  OpenAI chamar `api.openai.com` (o padrão), ele chama `openrouter.ai/api/v1`. Como
  os dois serviços falam o mesmo "idioma" HTTP, o SDK funciona sem precisar de
  nenhuma mudança de código.
- **Linha 18-21 (`defaultHeaders`)**: cabeçalhos HTTP extras enviados em toda
  requisição. `HTTP-Referer` e `X-Title` são específicos da OpenRouter — servem para
  identificar de onde vem o tráfego (aparecem nos rankings públicos de apps da
  OpenRouter). Não são obrigatórios, mas são boa prática.

```typescript
25 async generate(question: string): Promise<LlmResponse> {
```

- `async` marca essa função como **assíncrona**: por dentro, ela faz uma chamada de
  rede (que demora um tempo indeterminado) e o `async` permite usar `await` lá dentro
  para "pausar" a função até a resposta chegar, sem travar o resto do programa
  enquanto isso. `Promise<LlmResponse>` é o tipo de retorno: uma **promessa** de que,
  no futuro, vai existir um valor do tipo `LlmResponse` (ou a promessa vai falhar com
  um erro).

```typescript
29 const response = await this.client.chat.completions.create({
30   model: this.config.models[0]!,
31   models: this.config.models,
32   messages: [
33     { role: "system", content: this.config.systemPrompt },
34     { role: "user", content: question },
35   ],
36   stream: false,
37   temperature: this.config.temperature,
38   max_tokens: this.config.maxTokens,
39   provider: {
40     sort: this.config.provider.sort,
41     allow_fallbacks: this.config.provider.allowFallbacks,
42   },
43 } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
```

- **Linha 29 (`await`)**: espera a resposta da chamada de rede antes de continuar
  executando a próxima linha.
- **Linha 30 (`model`)**: o SDK da OpenAI exige um campo `model` obrigatório (porque
  na API original da OpenAI só existe um modelo por requisição). Preenchemos com o
  primeiro item da lista `models` só para satisfazer esse requisito do tipo — quem
  decide de verdade qual modelo usar é o campo `models` da linha 31 (extensão da
  OpenRouter).
- **Linha 31 (`models`)**: a lista de preferência de modelos, explicada em
  `config.ts`. Esse campo **não existe** na API da OpenAI — é uma extensão que só a
  OpenRouter entende.
- **Linha 32-35 (`messages`)**: toda conversa com um LLM (Large Language Model,
  "modelo de linguagem grande" — a IA generativa que responde texto) é representada
  como uma **lista de mensagens** com um `role` (papel):
  - `"system"`: instruções que moldam o comportamento do modelo (aqui vem de
    `systemPrompt`, definido em `config.ts`).
  - `"user"`: a pergunta feita pela pessoa usando a API — aqui, o parâmetro
    `question` recebido pela função.
  - Numa conversa com histórico (não é o caso deste projeto ainda), essa lista
    cresceria a cada resposta, indo e voltando para o modelo.
- **Linha 36 (`stream: false`)**: pede a resposta completa de uma vez, em vez de
  receber o texto sendo gerado token por token (*streaming*) — mais simples de tratar
  numa API síncrona feito essa.
- **Linha 37-38**: `temperature` controla o quão "criativa"/aleatória é a resposta
  (0 = bem determinístico, valores mais altos = mais variação). `max_tokens` limita
  o tamanho máximo da resposta gerada (aqui, 50 — respostas bem curtas).
- **Linha 39-42 (`provider`)**: aqui mapeamos manualmente `allowFallbacks` (nosso
  campo, em *camelCase*, convenção do JavaScript/TypeScript) para `allow_fallbacks`
  (o nome que a API REST da OpenRouter realmente espera, em *snake_case*). Essa
  incompatibilidade de nomenclatura foi descoberta testando contra a API real — sem
  esse mapeamento, a OpenRouter responde com erro 400 "Unrecognized key".
- **Linha 43 (`as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming`)**: isso é um
  **type assertion** ("eu, programador, garanto ao TypeScript que esse objeto tem
  esse tipo"). É necessário porque `models` e `provider` não fazem parte do tipo
  oficial do SDK da OpenAI (são extensões da OpenRouter) — sem essa asserção, o
  TypeScript recusaria compilar por "propriedade desconhecida".

```typescript
47 const content = response.choices?.[0]?.message?.content ?? "";
48 return { model: response.model, content: String(content) };
```

- **Linha 47**: `?.` é o **optional chaining** — em vez de quebrar o programa com um
  erro caso `response.choices` seja `undefined` (ou vazio), a expressão inteira
  simplesmente vira `undefined` e segue em frente. `??` é o **nullish coalescing** —
  "se o valor à esquerda for `null` ou `undefined`, use o valor à direita". Juntos:
  "pegue o texto da primeira resposta; se não existir por qualquer motivo, use string
  vazia em vez de quebrar".
- **Linha 48**: `String(content)` garante que o valor devolvido é sempre uma string
  de verdade (proteção extra, já que o tipo do SDK permite `content` ser outros
  formatos em cenários mais avançados, como resposta multimodal).

---

## `src/server.ts` — a rota HTTP `/chat`

```typescript
1  import Fastify from "fastify";
2  import type { OpenRouterService } from "./openrouter-service.ts";
```

- **Linha 2**: `import type` — de novo, importa só o **tipo**, não o valor. `server.ts`
  não precisa saber *como* o `OpenRouterService` funciona por dentro, só precisa do
  formato dele para o TypeScript checar. Essa é a ideia de **injeção de dependência**:
  o servidor recebe o serviço pronto de fora, em vez de criar sua própria instância.

```typescript
4  export const createServer = (routerService: OpenRouterService) => {
5    const app = Fastify({ logger: false });
```

- **Linha 4**: `createServer` é uma **função fábrica** — em vez de criar o servidor
  direto no arquivo (o que tornaria impossível testar com um serviço diferente a cada
  teste), ela recebe `routerService` como parâmetro e devolve um servidor configurado
  com ele. Isso é o que permite `tests/router-service.test.ts` criar servidores
  diferentes, cada um com uma configuração de `provider.sort` diferente.
- **Linha 5**: `Fastify({ logger: false })` cria a instância do framework. O
  `logger: false` desliga os logs automáticos do Fastify no console (útil para não
  poluir a saída dos testes).

```typescript
7  app.post("/chat", {
8    schema: {
9      body: {
10       type: "object",
11       required: ["question"],
12       properties: {
13         question: { type: "string", minLength: 1 },
14       },
15     },
16   },
17 }, async (request, reply) => {
```

- **Linha 7**: registra uma rota que responde a requisições `POST` no caminho
  `/chat`.
- **Linha 8-16 (`schema`)**: essa é uma funcionalidade central do Fastify — describe,
  em formato **JSON Schema**, como o corpo (`body`) da requisição deve ser:
  - `type: "object"`: o corpo deve ser um objeto JSON (não uma lista, não um texto solto).
  - `required: ["question"]`: o campo `question` é obrigatório.
  - `properties.question`: `question` deve ser uma `string` com pelo menos 1
    caractere (`minLength: 1` — rejeita string vazia).
  - **O ganho**: o Fastify valida isso **antes** do código da rota (linha 17 em
    diante) sequer começar a rodar. Se a validação falhar, o cliente recebe
    automaticamente um erro 400 (Bad Request) com detalhes — sem você escrever
    nenhum `if` manual.
- **Linha 17**: o *handler* da rota — a função que roda quando uma requisição válida
  chega. Recebe `request` (dados da requisição) e `reply` (objeto usado para
  responder).

```typescript
18   try {
19     const { question } = request.body as { question: string };
20     const response = await routerService.generate(question);
21     reply.send(response);
22   } catch (error) {
23     console.error("error handling /chat request", error);
24     reply.code(500).send({ error: "internal error" });
25   }
```

- **Linha 18-25 (`try/catch`)**: qualquer erro que aconteça **dentro** do bloco `try`
  (por exemplo, a chamada à OpenRouter falhar, ou dar timeout) é capturado pelo
  `catch`, em vez de derrubar o servidor inteiro. Isso é o que garante que o cliente
  sempre recebe uma resposta HTTP (nesse caso, um erro 500 controlado), mesmo quando
  algo dá errado.
- **Linha 19**: `request.body as { question: string }` — como o schema já garantiu
  (em tempo de execução) que `body.question` é uma string não vazia, aqui só
  precisamos dizer ao **TypeScript** (que não sabe sobre o schema JSON, só sobre
  tipos estáticos) qual é o formato esperado, via type assertion (`as`).
- **Linha 20**: chama o serviço que vimos acima, esperando (`await`) a resposta do
  modelo de linguagem.
- **Linha 21**: `reply.send(response)` envia a resposta (por padrão como JSON, com
  status 200).
- **Linha 24**: em caso de erro, responde com status 500 (erro interno do servidor) e
  uma mensagem genérica — nunca vazamos o erro técnico bruto para quem chamou a API,
  só o registramos no log do servidor (linha 23).

```typescript
28   return app;
29 };
```

- Devolve a instância do Fastify já configurada, pronta para ser usada (seja para
  subir de verdade em `index.ts`, seja para testar com `.inject()` nos testes).

---

## `src/index.ts` — o ponto de entrada

```typescript
1  import { createServer } from "./server.ts";
2  import { OpenRouterService } from "./openrouter-service.ts";
3  import { config } from "./config.ts";
4
5  const routerService = new OpenRouterService();
6  const app = createServer(routerService);
7  await app.listen({ port: config.port, host: "localhost" });
```

- **Linha 5**: cria o serviço de verdade, sem nenhum `configOverride` — usa a
  configuração padrão inteira de `config.ts`.
- **Linha 6**: monta o servidor, injetando esse serviço (a mesma função fábrica
  explicada acima).
- **Linha 7**: `app.listen(...)` efetivamente abre a porta de rede e começa a
  escutar requisições. O `await` aqui funciona porque, desde uma versão recente do
  Node, é permitido usar `await` no nível mais alto de um módulo (**top-level
  await**) — sem precisar envolver isso numa função `async` separada.

---

## `tests/router-service.test.ts` — testes automatizados

```typescript
1  import { test } from "node:test";
2  import assert from "node:assert";
```

- `node:test` e `node:assert` são módulos **embutidos** no Node (o prefixo `node:`
  deixa isso explícito) — não precisamos instalar nenhuma biblioteca de testes
  externa (como Jest ou Vitest) para este projeto.

```typescript
7  test("responde com o modelo mais barato disponível", async () => {
8    const cheapestConfig = {
9      provider: { ...config.provider, sort: "price" as const },
10   };
11   const routerService = new OpenRouterService(cheapestConfig);
12   const app = createServer(routerService);
```

- **Linha 7**: `test(nome, funcao)` registra um caso de teste com uma descrição
  legível.
- **Linha 8-10**: cria uma configuração parcial, usando o `configOverride` que vimos
  no `constructor` do `OpenRouterService`. `{ ...config.provider, sort: "price" as
  const }` copia o `provider` original e troca só o `sort`. `as const` diz ao
  TypeScript "trate essa string literal exatamente como `"price"`, não como `string`
  genérica" — necessário porque o tipo `ModelConfig.provider.sort` é um union type
  restrito (`"price" | "throughput" | "latency"`), não qualquer string.
- **Linha 11-12**: cria um serviço e um servidor **novos, isolados**, só para este
  teste — nenhum teste interfere no estado de outro.

```typescript
14   const response = await app.inject({
15     method: "POST",
16     url: "/chat",
17     body: { question: "hello world" },
18   });
```

- **`app.inject(...)`**: recurso do Fastify para **simular** uma requisição HTTP sem
  abrir uma porta de rede de verdade. Passa pelo mesmo caminho de validação de
  schema, roteamento e handler que uma requisição real passaria — só não envolve
  sockets/TCP. Isso torna o teste mais rápido e mais fácil de automatizar (não corre
  risco de porta ocupada, por exemplo).

```typescript
20   assert.strictEqual(response.statusCode, 200);
21   const body = response.json();
...
24   assert.strictEqual(body.model, "<modelo-mais-barato-que-voce-observou>");
```

- **Linha 20**: `assert.strictEqual(a, b)` falha o teste se `a` não for
  **exatamente igual** a `b` (comparação estrita, tipo `===`).
- **Linha 21**: `.json()` converte o corpo da resposta (texto) de volta para um
  objeto JavaScript.
- **Linha 24**: esse `assert` está com um **placeholder** de propósito — o comentário
  acima (linhas 22-23) explica que o nome do modelo mais barato muda com o tempo
  (preços de mercado mudam), então cabe a quem roda o teste rodar uma vez, ver no
  console qual modelo a OpenRouter escolheu de verdade, e substituir o placeholder
  por esse valor observado. Enquanto isso não for feito, **esse teste falha** (é
  esperado, não é bug).

O segundo teste (linhas 27-43) repete a mesma estrutura, mas com `sort: "throughput"`
(modelo mais rápido) em vez de `"price"`.

---

## `request.http` — testes manuais com a extensão REST Client

```
1  @baseUrl = http://localhost:3000
2
3  ### Chat - pergunta simples
4  POST {{baseUrl}}/chat
5  Content-Type: application/json
6
7  {
8    "question": "hello world"
9  }
```

- **Linha 1**: define uma **variável** `baseUrl`, reaproveitada como `{{baseUrl}}`
  nas requisições abaixo — se a porta mudar, só precisa editar aqui.
- **Linha 3**: `###` separa cada requisição dentro do mesmo arquivo — a extensão REST
  Client mostra um botão "Send Request" acima de cada bloco separado assim.
- **Linhas 4-9**: uma requisição HTTP crua, no formato que o protocolo HTTP realmente
  usa por baixo dos panos: método + caminho, depois cabeçalhos (`Content-Type`), uma
  linha em branco, e por fim o corpo (aqui, um JSON).
- Os dois últimos blocos do arquivo (`question` vazia e `question` ausente) existem
  de propósito para testar a validação de schema que vimos em `server.ts` — a
  expectativa é que ambos retornem erro 400, sem nunca chegar a chamar a OpenRouter.

---

## Por que o SDK `openai` em vez do `@openrouter/ai-sdk-provider` do tutorial?

O tutorial original (aula 4) mandava instalar `@openrouter/ai-sdk-provider@0.5.1` e
usar um código no formato `client.chat.completions.create(...)`. Na prática, ao tentar
montar o projeto, duas coisas não bateram:

1. Essa versão exata não existe mais no npm (o pacote pulou de `0.5.0` para `0.6.0`).
2. Mais importante: `@openrouter/ai-sdk-provider` é o **provider do Vercel AI SDK**
   (uma API diferente, baseada em `createOpenRouter()` + `generateText()`) — o formato
   `client.chat.completions.create()` do tutorial é, na verdade, o formato do **SDK da
   OpenAI**.

A solução adotada foi usar o SDK `openai` de verdade, apontando `baseURL` para
`https://openrouter.ai/api/v1` — a própria OpenRouter documenta essa forma de uso,
porque a API dela é compatível com a da OpenAI de propósito (para facilitar migração
de quem já usa OpenAI). O código ficou praticamente idêntico ao que o tutorial
descrevia, só trocando de onde vem a classe `OpenAI`/`OpenRouter`.

## Verifique seu entendimento

1. Por que `server.ts` recebe `routerService` como parâmetro em vez de criar o
   `OpenRouterService` internamente?
2. O que aconteceria se você removesse o `try/catch` de `server.ts` e a chamada à
   OpenRouter falhasse?
3. Por que os testes usam `app.inject()` em vez de subir o servidor com
   `app.listen()` e chamar com `fetch`?
4. Qual a diferença entre `models` (linha 31 do `openrouter-service.ts`) e `model`
   (linha 30)? Por que os dois existem na mesma chamada?
5. O que o `Partial<ModelConfig>` no `constructor` do `OpenRouterService` permite
   fazer que não seria possível se o parâmetro exigisse `ModelConfig` completo?
