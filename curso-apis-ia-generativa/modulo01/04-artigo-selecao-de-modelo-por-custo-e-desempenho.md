---
title: "Seleção dinâmica de modelo: preço, throughput e latência"
modulo: 1
aula: 4
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [openrouter, arquitetura, custo, desempenho, testes-automatizados]
fonte: docs/scrap/platos-legendas/output/curso-14082629/01-modulo-01/04-openrouter-na-pratica.md
---

# Seleção dinâmica de modelo: preço, throughput e latência

## O que essa aula quer te mostrar

A aula anterior te mostrou o **conceito** de escolher modelo por critério em vez de por nome fixo. Esta aula constrói isso de fato: um serviço TypeScript que encapsula a comunicação com o OpenRouter e decide, em tempo de execução, qual modelo usar — com base num critério configurável (preço, throughput ou latência).

## Três critérios, o mesmo código

O ponto central da implementação é que a **ordenação de modelos é um parâmetro de configuração**, não uma decisão travada no código. O serviço aceita uma lista de modelos candidatos e um campo `sort` que pode ser, por exemplo, `"price"` (mais barato primeiro) ou `"throughput"` (mais tokens/segundo primeiro). Isso significa que o mesmo código de integração serve para cenários bem diferentes:

- Um produto sensível a custo (ex: uma automação interna que roda milhares de vezes por dia) quer sempre o modelo mais barato disponível.
- Um produto sensível a experiência do usuário (ex: um chat em tempo real) quer o modelo com menor latência ou maior throughput, mesmo que custe um pouco mais.

## Um detalhe importante: "mais barato" pode mudar de um dia para o outro

Um ponto que a aula reforça bastante: **os preços e o desempenho dos modelos mudam com o tempo**, porque são decididos pelos provedores, não por você. Um modelo que hoje é o mais barato da sua lista pode não ser amanhã. Isso tem uma consequência prática direta: **testes automatizados que verificam "qual modelo foi escolhido" são frágeis** se você fixar o nome do modelo esperado — eles podem quebrar no futuro só porque o mercado mudou, não porque o seu código quebrou. A aula lida com isso escrevendo o teste de um jeito que deixa claro, no próprio teste, qual era o resultado esperado *no momento em que o teste foi escrito* — para que, se ele quebrar depois, fique óbvio que é preciso atualizar a expectativa, não necessariamente investigar um bug.

## Configuração sobrescrevível (para testar sem duplicar código)

Outro padrão de design que aparece: o serviço aceita uma configuração "padrão", mas permite que quem o usa **sobrescreva parcialmente** essa configuração (por exemplo, só o critério de ordenação, mantendo o resto igual). Isso evita duplicar toda a configuração só para testar uma variação — você parte da configuração existente e altera apenas o que precisa mudar para aquele teste específico.

## Por que isolar a integração numa classe/serviço próprio

Toda a comunicação com o OpenRouter fica isolada numa camada própria (um "serviço"), que a rota HTTP apenas chama. Isso separa duas responsabilidades que mudam por motivos diferentes:
- A rota HTTP (`/chat`) se preocupa com "como recebo e valido uma requisição".
- O serviço de integração se preocupa com "como falo com o provedor de LLM e qual modelo escolher".

Se amanhã você trocar de provedor (ou usar mais de um), só o serviço muda — a rota HTTP permanece igual. Esse é o mesmo princípio de **injeção de dependência** que aparece em qualquer sistema bem arquitetado, aplicado aqui à integração com IA.

## Verifique seu entendimento

1. Por que a ordenação de modelos (preço vs. throughput) é tratada como configuração, e não como código fixo?
2. Por que testes automatizados que verificam "qual modelo o sistema escolheu" podem quebrar no futuro mesmo sem nenhum bug no seu código?
3. Qual o benefício de isolar a chamada ao OpenRouter numa classe/serviço separado da rota HTTP?
