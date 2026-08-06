---
title: "Respostas: Verifique seu entendimento (01-artigo-json-estruturado-e-agentes)"
modulo: 3
tipo: respostas
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [structured-output, zod, openrouter, few-shot, revisao]
fonte: docs/curso-apis-ia-generativa/modulo03/01-artigo-json-estruturado-e-agentes.md
---
# Respostas: Verifique seu entendimento — 01-artigo-json-estruturado-e-agentes

Respostas às 5 perguntas de fixação do artigo [Transformando linguagem natural em JSON estruturado](01-artigo-json-estruturado-e-agentes.md), ligando cada uma ao código real do projeto em `modulo03/project/`.

## 1. Qual a diferença entre "extrair dados de um texto com regex/palavras-chave" e "pedir output estruturado a um modelo de LLM"?

Com regex/palavras-chave (o que o módulo 2 fazia, procurando `"upper"`/`"lower"` no texto), **você** escreve a lógica de interpretação — e ela só reconhece exatamente os padrões que você previu. Se o cliente escrever "quero deixar isso maiúsculo" em vez de "upper", quebra.

Com **output estruturado**, você não tenta interpretar o texto na mão — você descreve um **schema** (o formato de dados que quer receber) e delega a interpretação semântica para o modelo. O LLM lida bem com sinônimos, ordem de palavras trocada, erros de digitação — coisas que regex nunca vai cobrir todas. Seu código só valida se o que voltou bate com o formato esperado.

## 2. Por que o módulo usa o SDK da OpenAI (apontando para a URL do OpenRouter) em vez do SDK nativo do OpenRouter para esse caso específico?

O OpenRouter expõe uma API **compatível** com a da OpenAI (mesmo formato de requisição/resposta). O SDK da OpenAI, usado através do `@langchain/openai` (`ChatOpenAI`), tem o método `withStructuredOutput` — suporte maduro para pegar um schema Zod, converter em JSON Schema, mandar isso pra API via `response_format`, e já validar a resposta. O SDK nativo do OpenRouter não tem essa integração pronta com o LangChain. Então a jogada é: usar o cliente da OpenAI, mas apontando a `baseURL` para `https://openrouter.ai/api/v1` (ver `src/openrouter-service.ts`) — ganha-se o melhor dos dois mundos: integração madura + acesso aos modelos do OpenRouter.

## 3. O que são "few-shot examples" dentro de um system prompt, e por que a aula insiste tanto em usá-los?

São exemplos **concretos** de entrada → saída esperada, colocados dentro do próprio system prompt — não só regras descritas em texto. No `identifyIntentPrompts.ts` do projeto, por exemplo:

```
"Meu nome é João da Silva, quero agendar uma consulta com o doutor Alison hoje às 14h"
→ { intent: "schedule", professionalId: 1, professionalName: "Dr. Alison Reis", patientName: "João da Silva" }
```

Por que insistir nisso: modelos de linguagem são, no fundo, "máquinas de completar padrões". Mostrar 2-3 casos reais ensina o formato esperado muito melhor do que só descrever regras abstratas — reduz ambiguidade em casos difíceis (como resolver "hoje às 14h" para uma data ISO, ou casar "doutor Alison" com o `id: 1`).

## 4. Por que cada nó do grafo revalida os dados recebidos, mesmo que uma etapa anterior já os tenha validado?

Esse é o princípio **"confio, mas confiro"**. Mesmo que `identifyIntentNode` já tenha validado os dados com `IntentSchema`, o `scheduleNode` roda sua própria validação (`ScheduleRequiredSchema.safeParse(state)`) antes de agir. A ideia: tratar cada nó como um **microsserviço independente**, que nunca confia cegamente no que a etapa anterior devolveu — porque uma falha da IA, um bug futuro em `identifyIntentNode`, ou um schema mal ajustado poderiam deixar dados incompletos passarem. É uma camada extra de proteção antes de tocar o `appointmentService` de verdade.

## 5. Descreva o papel do "gerador de mensagens" no fluxo — por que ele também precisa de acesso à IA, diferente dos nós de agendamento/cancelamento?

Depois que `scheduleNode`/`cancelNode` executam a ação (sucesso ou erro), alguém precisa traduzir esse **resultado técnico** (`actionSuccess: true/false`, `actionError: "..."`) numa mensagem natural e empática pro cliente. É isso que `messageGeneratorNode` faz.

Ele precisa de acesso à IA — diferente de `scheduleNode`/`cancelNode`, que só processam dados e chamam um serviço — porque **gerar linguagem natural boa** (ajustar o tom pra sucesso vs. erro, personalizar com nome/data/profissional) é, em si, uma tarefa de geração de texto. Não dá pra fazer isso só com um template fixo tipo `"Consulta agendada com {nome}"` sem perder naturalidade e flexibilidade — por isso ele usa o mesmo `generateStructured` (com `MessageSchema`) que `identifyIntentNode` usa.
