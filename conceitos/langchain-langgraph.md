# LangChain.js / LangGraph: quando vale a pena usar

**Categoria:** Conceitos Gerais de IA (Orquestração)
**Relevante em:** sistemas com múltiplas etapas, tools, memória ou tratamento de falha em torno de um LLM
**Módulo que trata do assunto:** [modulo02/01-artigo-introducao-langchain-langgraph.md](../curso-apis-ia-generativa/modulo02/01-artigo-introducao-langchain-langgraph.md)

---

## Pra que serve, na prática

**LangChain.js** ajuda a organizar um sistema com LLM em **componentes
reutilizáveis** — nodes, chains, tools — em vez de concentrar toda a lógica
num único prompt gigante e monolítico. **LangGraph** (construído sobre o
LangChain) estrutura esses componentes como um **grafo**: nós conectados por
arestas, com estado compartilhado fluindo entre eles.

## O framework organiza, mas não substitui responsabilidade

Um erro comum é achar que adotar um framework de orquestração "resolve"
segurança e controle de fluxo automaticamente. Não resolve. **Guardrails**
(camadas de verificação de segurança) e **limites de fluxo** — como *max
retries* (número máximo de tentativas antes de desistir de repetir uma etapa
que falhou) — continuam sendo responsabilidade de quem constrói o sistema. O
framework só te dá a estrutura (nodes, edges, estado) pra encaixar essas
regras de forma organizada — ele não decide por você o que é seguro, nem
impede sozinho um loop infinito de retry.

## Quando a importância do framework aumenta

Num fluxo simples — uma chamada, um prompt, uma resposta — orquestração
formal quase não agrega, e pode até ser overhead desnecessário. A
importância cresce conforme entram, ao mesmo tempo:

- **múltiplas etapas** (o resultado de uma etapa alimenta a próxima)
- **tools** (o agente decide chamar ferramentas externas)
- **memória** (histórico de conversa ou contexto que precisa persistir)
- **tratamento de falha** (o que fazer quando uma etapa dá erro ou timeout)

Coordenar tudo isso manualmente, com `if/else` e variáveis soltas, fica
difícil de manter rápido — é aí que o framework paga o investimento.

### Exemplo de questão de revisão

> Analise as afirmações sobre LangChain.js:
> I. LangChain.js pode ajudar a organizar sistemas com LLM em componentes
> reutilizáveis, em vez de concentrar toda lógica em um único prompt.
> II. Guardrails e limites de fluxo (como max retries) são responsabilidades
> desnecessárias quando se usa framework de orquestração.
> III. A importância do LangChain.js aumenta quando há múltiplas etapas,
> tools, memória e tratamento de falhas.

**Resposta correta: V, F, V**

- **I — Verdadeira.** É a proposta central do framework: componentes
  reutilizáveis em vez de lógica concentrada num prompt só.
- **II — Falsa.** O framework organiza o fluxo, mas não elimina a
  necessidade de guardrails nem de limites como *max retries* — essas
  continuam sendo decisões de quem constrói o sistema.
- **III — Verdadeira.** É justamente nesse cenário (múltiplas etapas, tools,
  memória, falhas) que a orquestração formal compensa o esforço de adotá-la.
