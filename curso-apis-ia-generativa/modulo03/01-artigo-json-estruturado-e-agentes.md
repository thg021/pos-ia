---
title: "Transformando linguagem natural em JSON estruturado"
modulo: 3
aula: [1, 2, 3, 4]
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [structured-output, json-schema, zod, langgraph, agentes, prompt-engineering]
fonte: docs/scrap/platos-legendas/output/curso-14082629/03-modulo-03/
---

# Transformando linguagem natural em JSON estruturado

> Este artigo cobre as 4 aulas do módulo (identificando intenção, structured JSON, transformando intenção em ação, cancelando consultas) porque, na prática, elas constroem **um único projeto contínuo**, aula após aula — como um agendamento médico por linguagem natural. Faz mais sentido estudar o conceito de uma vez e ver a implementação completa no tutorial que acompanha este artigo.

## O problema central do módulo

Até aqui, o curso te ensinou a chamar um modelo de LLM e receber texto de volta. Mas a maioria das aplicações reais não quer só texto — quer **dado que o sistema consiga usar**: um ID de profissional, uma data, uma ação a executar. O módulo 3 resolve exatamente essa ponte: como pegar uma frase solta ("quero marcar uma consulta com a doutora Ana amanhã às 9h") e transformar isso em um objeto JSON confiável, com campos previsíveis, que o resto do seu sistema consegue consumir sem precisar interpretar texto livre.

## Structured output: pedir para o modelo devolver JSON, não texto

A técnica central é o **structured output** (saída estruturada): você define um **schema** (um "molde" de dados, usando a biblioteca **Zod**) que descreve exatamente quais campos a resposta do modelo deve ter e de que tipo. Em vez de receber uma frase e tentar extrair dados dela com regex ou palavras-chave, você entrega esse schema ao modelo e ele já devolve um JSON validado — encaixado nesse formato.

Isso é uma virada de chave importante: no módulo anterior, o código *interpretava* o texto de um jeito manual (buscando palavras como "upper" ou "lower"). A partir daqui, é o próprio modelo de linguagem que faz essa interpretação — e ele é muito mais robusto para lidar com variações de ordem das palavras, sinônimos e frases mal formadas do que qualquer verificação de string escrita à mão.

## Dois "textos" por chamada: o prompt de sistema e o schema de saída

Um padrão que se repete em toda chamada de LLM estruturada do módulo:
1. **System prompt**: as regras de como interpretar a entrada — quem são os profissionais disponíveis, que campos extrair, exemplos de entrada/saída (few-shot), e instruções específicas (ex: "sempre responda no idioma do cliente").
2. **JSON Schema (via Zod)**: o formato exato que a resposta precisa ter — por exemplo, `{ intent: "schedule" | "cancel" | "unknown", professionalId: number, dateTime: string, patientName: string }`.

Sem exemplos no prompt, o modelo tende a se perder mais facilmente — por isso a aula reforça bastante o uso de **few-shot examples** (exemplos concretos de entrada → saída esperada) dentro do próprio system prompt.

## Por que usar o SDK da OpenAI (via OpenRouter) em vez do SDK nativo do OpenRouter

Um detalhe técnico importante: para usar output estruturado de forma confiável, o módulo troca o SDK nativo do OpenRouter pelo **SDK da própria OpenAI** — porém apontando a `baseURL` para o endpoint do OpenRouter. Isso funciona porque o OpenRouter é compatível com a interface da API da OpenAI. A vantagem prática: o SDK da OpenAI (usado através do LangChain) tem suporte mais maduro para `response_format` estruturado com Zod, o que evita ter que fazer `JSON.parse` manual e tratar erros de parsing por conta própria — o parse já vem pronto.

## O padrão de dois passos: entender a intenção, depois agir

O fluxo do agente segue sempre a mesma estrutura de dois momentos:

1. **Identificar a intenção** (`identifyIntent`): o modelo recebe o texto do cliente e devolve um JSON com a intenção (agendar, cancelar, desconhecida) e os dados extraídos (profissional, data, paciente).
2. **Executar a ação correspondente**: dependendo da intenção identificada, o grafo roteia para o nó de agendamento, cancelamento, ou uma resposta de fallback — exatamente o mesmo mecanismo de aresta condicional (`addConditionalEdges`) já visto no módulo anterior, só que agora a decisão de rota vem de uma extração feita por IA, não de um `if` simples.

Depois de executar a ação (chamando um serviço interno, que simula uma API/banco de dados real), o resultado (sucesso ou erro) é traduzido de volta para linguagem natural por um terceiro nó — o **gerador de mensagens** — que também usa structured output, mas dessa vez para produzir uma mensagem amigável a partir de um resultado técnico (sucesso/erro + detalhes).

## "Confio, mas confiro": validação em cada nó

Um princípio de engenharia reforçado no módulo: mesmo que a IA já tenha extraído e validado os dados na etapa de identificação de intenção, cada nó seguinte **revalida o que recebeu** (usando `schema.safeParse` do Zod) antes de agir. A justificativa é tratar cada nó como se fosse um microsserviço independente — você não confia cegamente que quem chamou já validou tudo certo, porque isso protege contra dados incompletos ou mal-formados que passaram pela etapa anterior por qualquer motivo (falha da IA, schema mal definido, etc.).

## Injeção de dependência continua sendo o padrão

Assim como no módulo anterior, os nós que precisam de acesso à IA (identificar intenção, gerar mensagem) ou a um serviço de dados (agendar, cancelar) recebem essas dependências de fora — via uma "factory" que monta o grafo — em vez de instanciá-las internamente. Isso mantém nós como o de agendamento/cancelamento **sem nenhum conhecimento sobre como a IA funciona**: eles só recebem dados já validados e chamam um serviço.

## Verifique seu entendimento

1. Qual a diferença entre "extrair dados de um texto com regex/palavras-chave" e "pedir output estruturado a um modelo de LLM"?
2. Por que o módulo usa o SDK da OpenAI (apontando para a URL do OpenRouter) em vez do SDK nativo do OpenRouter para esse caso específico?
3. O que são "few-shot examples" dentro de um system prompt, e por que a aula insiste tanto em usá-los?
4. Por que cada nó do grafo revalida os dados recebidos, mesmo que uma etapa anterior já os tenha validado?
5. Descreva o papel do "gerador de mensagens" no fluxo — por que ele também precisa de acesso à IA, diferente dos nós de agendamento/cancelamento?
