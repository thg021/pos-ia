# Tool calling iterativo vs. camada service (query/intenção estruturada)

**Categoria:** Conceitos Gerais de IA (Arquitetura de agentes)
**Relevante em:** aplicações onde o LLM precisa consultar dados (vendas, relatórios, banco de dados) para responder
**Módulo que trata do assunto:** [modulo06/01-artigo-text-to-cypher-multi-step-reasoning.md](../curso-apis-ia-generativa/modulo06/01-artigo-text-to-cypher-multi-step-reasoning.md)

---

## O trade-off

Existem duas formas comuns de um agente de IA "buscar dados" pra responder
uma pergunta:

**Tool calling iterativo** — o agente decide, chamada por chamada, se e qual
ferramenta usar, interpreta o resultado, e decide o próximo passo:

```
LLM: planeja → chama tool → LLM: interpreta resultado → chama outra tool → ... → responde
```

Cada seta que passa por "LLM" é uma chamada nova ao modelo. Ganha-se
flexibilidade (o agente se adapta a perguntas que não foram previstas,
combina ferramentas em ordens diferentes), mas o custo em chamadas/latência
tende a **subir** conforme a pergunta exige mais passos.

**Camada service** — o LLM faz só uma etapa (interpretar a pergunta e montar
uma query/intenção estruturada), e a partir daí a execução é determinística
— validações, regras de negócio, consulta ao banco — sem depender do modelo
de novo:

```
LLM: pergunta → intenção estruturada → service (determinístico) → resposta
```

Reduz chamadas ao modelo e centraliza regra de negócio num lugar só, mas com
**menos flexibilidade dinâmica**: se a intenção estruturada não previu um
caso, a service não improvisa como um agente faria.

### Exemplo de questão de revisão

> Em uma aplicação de IA que consulta dados de vendas, qual alternativa
> descreve melhor esse trade-off?

**Resposta correta:** tool calling iterativo pode aumentar chamadas ao LLM
(planejar → chamar tool → interpretar resultado → possivelmente chamar outra
tool), enquanto uma service pode reduzir interações do modelo ao centralizar
execução e regras — porém com menor flexibilidade dinâmica.

Errado seria dizer que: os dois têm o mesmo custo (ignora que o custo real
está nas chamadas ao LLM, não só na query ao banco); que tool calling
*reduz* chamadas (é o contrário — tende a aumentar); que service só faz
sentido sem LLM no sistema (faz sentido justamente pra reduzir a dependência
dele na execução); ou que service elimina completamente alucinação e erro de
negócio (a intenção que chega na service ainda pode ter sido mal interpretada
pelo modelo antes).

## Onde isso aparece no módulo 6

O módulo 6 é essencialmente uma variação estruturada dessa segunda
abordagem: em vez do agente escolher e chamar ferramentas livremente, a
pergunta em linguagem natural do cliente vira uma **query gerada
dinamicamente** (Cypher, no caso — mas o padrão funciona igual com SQL), com
uma camada de resiliência em volta (correção de sintaxe, decomposição de
perguntas complexas em sub-perguntas, tradução do resultado bruto de volta
pra linguagem natural). É um meio-termo: mais estruturado que tool calling
livre, mas ainda gerado dinamicamente pelo LLM a cada pergunta nova — não é
uma service 100% fixa nem um agente 100% livre.
