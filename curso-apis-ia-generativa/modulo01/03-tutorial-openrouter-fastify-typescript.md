---
title: "Tutorial: montando a API base com Fastify + TypeScript nativo"
modulo: 1
aula: 3
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [nodejs, typescript, fastify, openrouter, setup-de-projeto]
fonte: docs/scrap/platos-legendas/output/curso-14082629/01-modulo-01/03-openrouter-na-pratica.md
---
# Tutorial: montando a API base com Fastify + TypeScript nativo

Este tutorial monta a estrutura que vai servir de base para todos os projetos do curso: uma API HTTP em Node.js que vai expor um endpoint `/chat`, pronta para depois ser conectada ao OpenRouter (isso vem no tutorial da aula 4).

## Pré-requisitos

- **Node.js 24+** — importante usar a mesma versão major do curso, porque vamos usar suporte nativo a TypeScript do Node (sem precisar de um transpilador como `tsc` ou `ts-node`).
- Recomendado usar o **NVM** (Node Version Manager) para trocar de versão do Node facilmente: `nvm use 24`.

> **Por que TypeScript "nativo"?** Versões recentes do Node.js conseguem rodar arquivos `.ts`
> diretamente (via `--experimental-strip-types` em versões mais antigas, nativo a partir de
> certas versões do Node 24). Isso significa: você ganha tipagem no editor, mas o Node não gera
> nenhum arquivo `.js` intermediário — ele só "ignora" as anotações de tipo em tempo de execução.
> É mais simples que configurar um pipeline de build, ao custo de não poder usar todo recurso
> avançado de um transpilador completo.

## Passo 1 — Inicializar o projeto

Crie a pasta do módulo (ex: `modulo01/aula03-smart-model-router-gateway`) e rode dentro dela:

```bash
npm init -y
npm install fastify@5.7.0
npm install --save-dev @types/node@24
```

> Fixar a versão do Fastify (`5.7.0`) é intencional: garante que o projeto continue funcionando
> do mesmo jeito mesmo que versões futuras da lib mudem comportamento.

## Passo 2 — Estrutura mínima de pastas

```
seu-projeto/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json   (só para o editor entender os tipos — não gera build)
```

Crie `src/index.ts` com o conteúdo mínimo para validar que tudo está funcionando:

```typescript
console.log("hello");
```

## Passo 3 — Scripts de desenvolvimento com live reload

No `package.json`, adicione um script `dev` usando o *watch mode* nativo do Node — qualquer alteração no arquivo reinicia o processo automaticamente:

```json
{
  "scripts": {
    "dev": "node --watch src/index.ts"
  }
}
```

Rode com `npm run dev`. Você deve ver `hello` impresso no terminal, e qualquer alteração salva no arquivo deve reiniciar o processo sozinha.

## Passo 4 — Debugger integrado (em vez de `console.log`)

Um hábito que vale adotar desde o primeiro projeto: usar o depurador do editor em vez de encher o código de `console.log`. No VS Code:

1. Vá na aba **Run and Debug** (ícone de "play com bug") e selecione o modo de terminal com debug integrado (*JavaScript Debug Terminal*).
2. Rode `npm run dev` dentro desse terminal de debug.
3. Clique à esquerda do número da linha no editor para colocar um *breakpoint*.
4. Quando a execução chegar naquela linha, ela pausa e você pode inspecionar variáveis, objetos e o estado completo do programa — muito mais rico que imprimir valores manualmente.

## Passo 5 — Configuração de tipos para o editor

Para o VS Code entender bem os tipos do TypeScript sem exigir um transpilador, é preciso um `tsconfig.json` mínimo (apenas para o editor, `noEmit` — não gera nenhum arquivo). Depois de criar/alterar esse arquivo, use `Ctrl+Shift+P` → **TypeScript: Restart TS Server** no VS Code para garantir que o editor releia a configuração.

## Passo 6 — Criando a primeira rota da API

Crie `src/server.ts`:

```typescript
import Fastify from "fastify";

export const createServer = () => {
  const app = Fastify();

  app.post("/chat", {
    schema: {
      body: {
        type: "object",
        required: ["question"],
        properties: {
          question: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { question } = request.body as { question: string };
      reply.send({ answer: "hello" });
    } catch (error) {
      console.error("error handling /chat request", error);
      reply.code(500).send({ error: "internal error" });
    }
  });

  return app;
};
```

Pontos importantes desse trecho:

- O `schema.body` faz o **Fastify validar automaticamente** o corpo da requisição antes mesmo de o código da rota rodar — se `question` não vier, ou vier vazio, o cliente recebe um erro de validação sem você escrever nenhum `if`.
- `minLength: 1` é uma validação simples para impedir que o cliente mande uma pergunta vazia.
- O `try/catch` com `reply.code(500)` garante que qualquer erro inesperado retorna um status HTTP apropriado, em vez de derrubar o servidor.

Atualize `src/index.ts` para usar essa função:

```typescript
import { createServer } from "./server.ts";

const app = createServer();
await app.listen({ port: 3000, host: "localhost" });
```

> Repare que o import termina em `.ts` — como não há transpilação, o Node.js precisa do caminho
> exato do arquivo que ele vai executar.

Se aparecer um erro sobre "import fora de um módulo", adicione ao `package.json`:

```json
{ "type": "module" }
```

## Passo 7 — Validando a rota sem precisar de um cliente HTTP externo

O Fastify tem um recurso chamado `inject`, que simula uma requisição HTTP real sem precisar subir um servidor de verdade nem usar `curl`/Postman — ótimo para testes rápidos e automatizados:

```typescript
const response = await app.inject({
  method: "POST",
  url: "/chat",
  body: { question: "hello world" },
});

console.log(response.statusCode);
console.log(response.body);
```

Rodando isso, você deve ver `200` e o corpo `{"answer":"hello"}` — confirmando que a rota, a validação de schema e o fluxo de resposta estão funcionando **antes** de qualquer integração real com um modelo de LLM.

## Passo 8 — Explorando o OpenRouter antes de integrar via código

Antes de escrever o código de integração (isso fica para o tutorial da aula 4), vale explorar a plataforma do OpenRouter:

- Em **Models**, você pode ordenar os modelos disponíveis por preço, por *throughput* (tokens por segundo) ou por latência.
- Em **Chat**, é possível selecionar 2+ modelos e comparar as respostas ao mesmo prompt lado a lado — inclusive comparando um modelo gratuito com um pago.
- A seção de **ranking/market share** mostra quais modelos são mais usados globalmente — útil como referência do que já foi validado por outras equipes.

## Verifique seu entendimento

1. Por que o projeto usa `node --watch` com arquivos `.ts` direto, em vez de configurar um transpilador como `tsc`? - Faz o auto reload do projeto, recurso nativo do node.
2. O que o `schema.body` da rota Fastify resolve que, sem ele, você teria que validar manualmente? Verifica se há existe o valor passado no corpo da requisição, caso nao tenho uma exceção é lançada. Sem teriamos que validar se há alguma dado no objeto body, se existe alguma propriedade no objeto
3. Qual a vantagem de usar `app.inject()` em vez de subir o servidor e testar com uma ferramenta HTTP externa? Ele injeta a chamada simulando um request paara o servidor
4. Se seu servidor não iniciar por causa de "import fora de um módulo", o que costuma resolver isso no `package.json`? Alterar o type para module

## Feedback das respostas

**Q1 — incompleta/desviada do ponto principal.** A resposta descreve o `--watch` (recarrega o processo ao salvar), que é um recurso separado. A pergunta é sobre por que não precisa de `tsc`: o motivo é que o Node 24 tem suporte nativo para interpretar arquivos `.ts` diretamente, descartando as anotações de tipo em tempo de execução, sem gerar nenhum `.js` intermediário (ver o quadro "Por que TypeScript nativo?" acima).

**Q2 — ideia correta, redação para revisar.** O conteúdo está certo: o Fastify valida o corpo automaticamente antes do handler rodar, então você não precisa escrever `if` manuais para checar presença/tipo dos campos. Vale reescrever com mais precisão, por exemplo: "Sem `schema.body`, seria preciso checar manualmente (com `if`) se `question` veio no corpo e se não está vazia antes de processar a requisição. Com o schema, o Fastify faz essa validação antes do handler executar e já responde com erro de validação caso falhe."

**Q3 — resposta descreve o mecanismo, não a vantagem.** "Injetar a chamada simulando um request" é a definição do `inject()`, mas a pergunta pede a vantagem sobre subir o servidor de verdade. Resposta mais completa: `app.inject()` não precisa subir um servidor real nem ocupar uma porta de rede — é mais rápido e ideal para testes automatizados, já que testa o mesmo fluxo de roteamento/validação/resposta sem I/O de rede.

**Q4 — correta.** "Alterar o `type` para `module`" é exatamente a solução indicada no texto (linha 138).
