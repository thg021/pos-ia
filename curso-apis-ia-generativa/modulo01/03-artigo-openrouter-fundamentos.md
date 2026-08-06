---
title: "OpenRouter: um roteador entre você e dezenas de modelos de LLM"
modulo: 1
aula: 3
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [openrouter, arquitetura, abstracao-de-provedor, llm]
fonte: docs/scrap/platos-legendas/output/curso-14082629/01-modulo-01/03-openrouter-na-pratica.md
---

# OpenRouter: um "roteador" entre você e dezenas de modelos de LLM

---

## O problema que o OpenRouter resolve

No artigo da aula 1 vimos um risco: se seu produto depende de **um único** provedor de LLM (só OpenAI, só Google...), qualquer mudança de preço ou de política daquele provedor pode quebrar seu negócio. O **OpenRouter** é a resposta técnica a esse risco: é um serviço que expõe uma **API única** na frente de dezenas de modelos de LLM de provedores diferentes (OpenAI, Google, Anthropic, DeepSeek, modelos open-source, etc.).

Pense nele como um "gateway" (portão de entrada): seu código não fala diretamente com a OpenAI ou com o Google — ele fala com o OpenRouter, e é o OpenRouter quem decide (ou deixa você decidir) qual modelo real vai responder aquela chamada.

## A ideia central: escolher modelo por critério, não por nome fixo

Ao invés de escrever no código "sempre use o GPT-4", você define uma **lista de modelos candidatos** e um **critério de ordenação** — por exemplo: "entre estes 5 modelos, use sempre o mais barato" ou "use sempre o que responde mais rápido (maior throughput)". O OpenRouter então escolhe dinamicamente qual modelo real atende esse critério no momento da chamada.

Isso é poderoso por dois motivos:
1. **Resiliência a mudança de preço.** Se o modelo mais barato de hoje encarecer amanhã, seu código não muda — ele volta a escolher automaticamente o novo mais barato da sua lista.
2. **Você separa "o que meu produto precisa" (barato? rápido? mais inteligente?) de "qual modelo específico resolve isso agora"** — uma decisão de negócio separada de uma decisão de infraestrutura.

## Testando modelos sem escrever código

Antes de programar qualquer coisa, o OpenRouter já oferece um ambiente de chat na própria plataforma onde você pode comparar, lado a lado, como modelos diferentes respondem ao mesmo prompt — e ver a diferença de velocidade e "personalidade" entre eles. A recomendação prática: use essa tela para validar se o seu prompt está trazendo a resposta certa **antes** de sair escrevendo código de integração. É uma iteração muito mais rápida do que testar via API a cada ajuste de prompt.

A plataforma também expõe um ranking público de uso (quais modelos são mais chamados no mundo todo, quanto cada provedor representa do mercado) — útil para se orientar sobre o que outras equipes estão validando como "bom o suficiente" para produção, sem você precisar testar tudo do zero.

## O projeto que vamos construir neste módulo

A partir daqui, o curso constrói um pequeno serviço em **Node.js + TypeScript + Fastify** com uma única responsabilidade: receber uma pergunta via API HTTP e repassar para o OpenRouter, que escolhe o modelo de LLM mais adequado segundo um critério configurável (preço, throughput, latência). Essa estrutura de projeto (API + serviço de integração com LLM + testes automatizados) vai se repetir em todos os módulos seguintes do curso — é a "base" reutilizável.

## Verifique seu entendimento

1. Por que usar um "roteador" de modelos como o OpenRouter reduz o risco de depender de um único provedor de LLM?
2. Qual a diferença entre escrever "sempre use o modelo X" e "sempre use o modelo mais barato entre X, Y e Z"?
3. Por que faz sentido testar prompts na interface de chat do OpenRouter antes de escrever código de integração?
