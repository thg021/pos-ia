# Structured outputs e provider strategy

**Categoria:** Conceitos Gerais de IA
**Relevante em:** qualquer sistema que precisa processar a resposta do LLM por código (não só exibir texto pra humano)
**Módulo que trata do assunto:** [modulo03/01-artigo-json-estruturado-e-agentes.md](../curso-apis-ia-generativa/modulo03/01-artigo-json-estruturado-e-agentes.md)

---

## O que resolve, e o que não resolve

**Structured output** (saída estruturada) é forçar o modelo a responder num
formato definido — tipicamente JSON com um schema — em vez de texto livre.
Isso torna a saída **previsível e processável por código**: em vez de
parsear texto na esperança de achar os dados certos, o código recebe algo
com forma garantida.

Uma **provider strategy** (estratégia de provedor) é a decisão de como
impor esse formato. Quando o provedor de LLM oferece um mecanismo **nativo**
pra isso (modo JSON nativo, function calling estruturado), a estratégia pode
aproveitar esse suporte pra validar o formato na origem — em vez de confiar
só em instrução de prompt + validação depois no seu código.

O ponto importante: structured output resolve **formato**. Não resolve:

- **Validação de negócio** — os valores fazem sentido pro seu domínio? (ex:
  uma data de agendamento estruturada corretamente, mas no passado)
- **Permissões antes de tool calling** — esse usuário pode mesmo executar
  essa ação? Formato correto não implica autorização.

São camadas independentes — uma coisa é a saída estar bem formatada, outra é
ela ser segura ou correta de executar. Isso é a mesma lógica de **segurança
em camadas** já vista em
[safeguards-e-prompt-injection.md](safeguards-e-prompt-injection.md):
nenhuma camada isolada é suficiente.

### Exemplo de questão de revisão

> Analise as afirmações sobre structuredOutputs e providerStrategy:
> I. Structured outputs ajudam a tornar a saída do modelo mais previsível e
> processável por código.
> II. Uma estratégia de provider pode aproveitar mecanismos nativos do
> provedor para impor/validar formato, quando disponíveis.
> III. Structured outputs eliminam a necessidade de validação de negócio e
> de permissões antes de tool calling.

**Resposta correta: V, V, F**

- **I — Verdadeira.** É a razão de existir do structured output.
- **II — Verdadeira.** Aproveitar suporte nativo do provedor, quando
  existe, valida o formato na origem em vez de só depois, no seu código.
- **III — Falsa.** Formato correto não substitui validação de negócio nem
  checagem de permissão — são responsabilidades separadas.
